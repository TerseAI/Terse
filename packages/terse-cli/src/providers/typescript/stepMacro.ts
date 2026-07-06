import type TS from "typescript"

export type StepDef = { name: string; def: string }
export type StepEdit = { start: number; end: number; text: string }

export enum StepCallKind {
    JobStep = "jobStep",
    Step = "step"
}

export type StepCall = { kind: StepCallKind.Step; call: TS.CallExpression } | { kind: StepCallKind.JobStep; call: TS.CallExpression; config: TS.ObjectLiteralExpression }

// The local binding of `import { step } from "terse-sdk"` (aliases included), so plain
// `step` stays a safe name: user-defined step() functions never match the macro.
export function findStepImportName(ts: typeof TS, sf: TS.SourceFile): string | null {
    for (const statement of sf.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "terse-sdk") continue
        const named = statement.importClause?.namedBindings
        if (!named || !ts.isNamedImports(named)) continue
        const element = named.elements.find(el => (el.propertyName ?? el.name).text === "step")
        if (element) return element.name.text
    }
    return null
}

export function matchStepCall(ts: typeof TS, node: TS.Node, stepName: string | null): StepCall | null {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression)) return null
    if (stepName !== null && node.expression.text === stepName) {
        return { kind: StepCallKind.Step, call: node }
    }
    if (node.expression.text === "jobStep" && node.arguments.length > 0 && ts.isObjectLiteralExpression(node.arguments[0])) {
        return { kind: StepCallKind.JobStep, call: node, config: node.arguments[0] }
    }
    return null
}

// MARK: step

// `step(client.method(args))` hoists only the callee into a "use step" function.
// The argument expressions stay at the call site, where they evaluate in workflow
// scope and cross the step boundary as serialized step arguments.
export function transformStep(ts: typeof TS, sf: TS.SourceFile, step: Extract<StepCall, { kind: StepCallKind.Step }>, fileName: string, index: number, stepName: string | null): { stepDef: StepDef; edit: StepEdit } {
    const { call } = step
    const inner = call.arguments.length === 1 ? call.arguments[0] : undefined
    if (inner === undefined) throw stepMacroError(sf, call, fileName, "step() takes exactly one argument: a direct call, e.g. step(client.method(args)).")
    if (!ts.isCallExpression(inner))
        throw stepMacroError(sf, call, fileName, "step() must wrap a direct call, e.g. step(client.method(args)). Storing the promise in a variable first is not supported.")
    if (containsStepCall(ts, inner, stepName)) throw stepMacroError(sf, call, fileName, "Steps cannot be nested inside a step() call. Await each step separately.")

    const calleeNames: string[] = []
    let optionalChain = false
    let calleeRoot: TS.Expression = inner.expression
    while (ts.isPropertyAccessExpression(calleeRoot)) {
        calleeNames.unshift(calleeRoot.name.text)
        if (calleeRoot.questionDotToken) optionalChain = true
        calleeRoot = calleeRoot.expression
    }
    if (!ts.isIdentifier(calleeRoot)) {
        throw stepMacroError(sf, call, fileName, "step() requires a plain property path like step(client.method(args)). Computed access and intermediate calls are not supported.")
    }
    calleeNames.unshift(calleeRoot.text)
    if (isDeclaredInEnclosingScopes(ts, call, calleeRoot.text)) {
        throw stepMacroError(sf, call, fileName, `\`${calleeRoot.text}\` is declared inside the handler. The step runs in a separate bundle, so move \`${calleeRoot.text}\` to module scope.`)
    }
    for (const arg of inner.arguments) {
        const fnArg = findLiteralFunctionArg(ts, arg)
        if (fnArg) {
            throw stepMacroError(
                sf,
                fnArg,
                fileName,
                "A function passed as a step argument cannot cross the step boundary, because step arguments are serialized into the journal. Move the whole call into a module-scope helper so the callback stays inside the step, then wrap the helper call in step()."
            )
        }
    }

    // `typeof` type queries reject `?.`, so optional-chain callees fall back to untyped args.
    const calleeText = inner.expression.getText(sf)
    const paramsType = optionalChain ? "" : `: Parameters<typeof ${calleeText}>`
    const returnType = optionalChain ? "" : `: Promise<Awaited<ReturnType<typeof ${calleeText}>>>`
    const name = `terseStep_${calleeNames.join("_")}_${index}`
    const def = `export async function ${name}(...__terseArgs${paramsType})${returnType} {\n` + `  "use step"\n` + `  return await ${calleeText}(...__terseArgs)\n` + `}`
    const text = `${name}(${inner.arguments.map(a => a.getText(sf)).join(", ")})`
    return { stepDef: { name, def }, edit: { start: call.getStart(sf), end: call.getEnd(), text } }
}

// MARK: jobStep

export function transformJobStep(
    ts: typeof TS,
    sf: TS.SourceFile,
    step: Extract<StepCall, { kind: StepCallKind.JobStep }>,
    fileName: string,
    index: number,
    stepName: string | null
): { stepDef: StepDef; edit: StepEdit } | null {
    const isProp = (p: TS.ObjectLiteralElementLike, key: string): p is TS.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key
    const { call, config } = step
    const inputProp = config.properties.find(p => isProp(p, "input"))
    const inputSchemaProp = config.properties.find(p => isProp(p, "inputSchema"))
    const outputSchemaProp = config.properties.find(p => isProp(p, "outputSchema"))
    const run = config.properties.find(p => isProp(p, "run"))?.initializer

    if (!run || !(ts.isArrowFunction(run) || ts.isFunctionExpression(run))) return null
    if (containsStepCall(ts, config, stepName)) throw stepMacroError(sf, call, fileName, "Steps cannot be nested inside a jobStep(). Await each step separately.")

    const name = `terseStep_${index}`
    const def = stepFunctionText(ts, sf, name, run, inputSchemaProp?.initializer, outputSchemaProp?.initializer)
    const text = `${name}(${inputProp ? inputProp.initializer.getText(sf) : ""})`
    return { stepDef: { name, def }, edit: { start: call.getStart(sf), end: call.getEnd(), text } }
}

function stepFunctionText(
    ts: typeof TS,
    sf: TS.SourceFile,
    name: string,
    run: TS.ArrowFunction | TS.FunctionExpression,
    inputSchema: TS.Expression | undefined,
    outputSchema: TS.Expression | undefined
): string {
    const param = inputSchema ? "__terseArgs" : ""
    const parseInput = inputSchema ? `  const __terseInput = (${inputSchema.getText(sf)}).parse(__terseArgs)\n` : ""
    const callRun = inputSchema ? `(${run.getText(sf)})(__terseInput)` : `(${run.getText(sf)})()`
    const validated = outputSchema ? `(${outputSchema.getText(sf)}).parse(__terseResult)` : `__terseResult`
    return `export async function ${name}(${param}) {\n` + `  "use step"\n` + parseInput + `  const __terseResult = await ${callRun}\n` + `  return ${validated}\n` + `}`
}

// MARK: Helpers

// Finds a function expression that ends up inside the evaluated argument value,
// where serialization would reject it: the argument itself, or a literal object
// property / array element (recursively). Functions merely consumed while the
// argument evaluates, like the arrow in `users.map(u => u.email)`, are fine since
// only the resulting data crosses the boundary. Those sit inside call expressions,
// which this deliberately does not descend into.
function findLiteralFunctionArg(ts: typeof TS, node: TS.Node): TS.Node | null {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return node
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return findLiteralFunctionArg(ts, node.expression)
    if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
            if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) return property
            if (ts.isPropertyAssignment(property)) {
                const found = findLiteralFunctionArg(ts, property.initializer)
                if (found) return found
            }
        }
        return null
    }
    if (ts.isArrayLiteralExpression(node)) {
        for (const element of node.elements) {
            const found = findLiteralFunctionArg(ts, element)
            if (found) return found
        }
        return null
    }
    return null
}

function stepMacroError(sf: TS.SourceFile, node: TS.Node, fileName: string, message: string): Error {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
    return new Error(`${fileName}:${line}: ${message}`)
}

function containsStepCall(ts: typeof TS, node: TS.Node, stepName: string | null): boolean {
    const walk = (n: TS.Node): true | undefined => (matchStepCall(ts, n, stepName) ? true : ts.forEachChild(n, walk))
    return ts.forEachChild(node, walk) ?? false
}

// Lexical lookup along the parent chain: params of enclosing functions and
// declarations directly inside enclosing blocks. Anything not found here is
// module-scope (or a global), which the steps bundle can also see.
function isDeclaredInEnclosingScopes(ts: typeof TS, from: TS.Node, name: string): boolean {
    let cur: TS.Node | undefined = from.parent
    while (cur && !ts.isSourceFile(cur)) {
        if (scopeDeclares(ts, cur, name)) return true
        cur = cur.parent
    }
    return false
}

function scopeDeclares(ts: typeof TS, node: TS.Node, name: string): boolean {
    if (ts.isFunctionLike(node)) return node.parameters.some(p => bindingDeclares(ts, p.name, name))
    if (ts.isBlock(node)) return node.statements.some(s => statementDeclares(ts, s, name))
    if (ts.isCatchClause(node)) return node.variableDeclaration !== undefined && bindingDeclares(ts, node.variableDeclaration.name, name)
    if (ts.isForOfStatement(node) || ts.isForInStatement(node)) return ts.isVariableDeclarationList(node.initializer) && node.initializer.declarations.some(d => bindingDeclares(ts, d.name, name))
    if (ts.isForStatement(node)) return node.initializer !== undefined && ts.isVariableDeclarationList(node.initializer) && node.initializer.declarations.some(d => bindingDeclares(ts, d.name, name))
    return false
}

function statementDeclares(ts: typeof TS, statement: TS.Statement, name: string): boolean {
    if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.some(d => bindingDeclares(ts, d.name, name))
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) return statement.name?.text === name
    return false
}

function bindingDeclares(ts: typeof TS, binding: TS.BindingName, name: string): boolean {
    if (ts.isIdentifier(binding)) return binding.text === name
    return binding.elements.some(el => !ts.isOmittedExpression(el) && bindingDeclares(ts, el.name, name))
}
