import type TS from "typescript"

export type StepDef = { name: string; def: string }
export type StepEdit = { start: number; end: number; text: string }

export enum StepCallKind {
    JobStep = "jobStep",
    AsStep = "asStep"
}

export type StepCall = { kind: StepCallKind.AsStep; call: TS.CallExpression; receiver: TS.Expression } | { kind: StepCallKind.JobStep; call: TS.CallExpression; config: TS.ObjectLiteralExpression }

export function matchStepCall(ts: typeof TS, node: TS.Node): StepCall | null {
    if (!ts.isCallExpression(node)) return null
    if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "asStep") {
        return { kind: StepCallKind.AsStep, call: node, receiver: node.expression.expression }
    }
    if (ts.isIdentifier(node.expression) && node.expression.text === "jobStep" && node.arguments.length > 0 && ts.isObjectLiteralExpression(node.arguments[0])) {
        return { kind: StepCallKind.JobStep, call: node, config: node.arguments[0] }
    }
    return null
}

// MARK: asStep

// `client.method(args).asStep()` hoists only the callee into a "use step" function.
// The argument expressions stay at the call site, where they evaluate in workflow
// scope and cross the step boundary as serialized step arguments.
export function transformAsStep(ts: typeof TS, sf: TS.SourceFile, step: Extract<StepCall, { kind: StepCallKind.AsStep }>, fileName: string, index: number): { stepDef: StepDef; edit: StepEdit } {
    const { call, receiver } = step
    if (call.arguments.length > 0) throw stepMacroError(sf, call, fileName, "asStep() takes no arguments.")
    if (!ts.isCallExpression(receiver))
        throw stepMacroError(sf, call, fileName, "asStep() must be chained directly onto a call, e.g. client.method(args).asStep(). Storing the promise in a variable first is not supported.")
    if (containsStepCall(ts, receiver)) throw stepMacroError(sf, call, fileName, "jobStep() and asStep() cannot be nested inside an asStep() call. Await each step separately.")

    const calleeNames: string[] = []
    let calleeRoot: TS.Expression = receiver.expression
    while (ts.isPropertyAccessExpression(calleeRoot)) {
        calleeNames.unshift(calleeRoot.name.text)
        calleeRoot = calleeRoot.expression
    }
    if (!ts.isIdentifier(calleeRoot)) {
        throw stepMacroError(sf, call, fileName, "asStep() requires a plain property path like client.method(args). Computed access and intermediate calls are not supported.")
    }
    calleeNames.unshift(calleeRoot.text)
    if (isDeclaredInEnclosingScopes(ts, call, calleeRoot.text)) {
        throw stepMacroError(sf, call, fileName, `\`${calleeRoot.text}\` is declared inside the handler. The step runs in a separate bundle, so move \`${calleeRoot.text}\` to module scope.`)
    }

    const name = `terseStep_${calleeNames.join("_")}_${index}`
    const def = `export async function ${name}(...__terseArgs) {\n` + `  "use step"\n` + `  return await ${receiver.expression.getText(sf)}(...__terseArgs)\n` + `}`
    const text = `${name}(${receiver.arguments.map(a => a.getText(sf)).join(", ")})`
    return { stepDef: { name, def }, edit: { start: call.getStart(sf), end: call.getEnd(), text } }
}

// MARK: jobStep

export function transformJobStep(
    ts: typeof TS,
    sf: TS.SourceFile,
    step: Extract<StepCall, { kind: StepCallKind.JobStep }>,
    fileName: string,
    index: number
): { stepDef: StepDef; edit: StepEdit } | null {
    const isProp = (p: TS.ObjectLiteralElementLike, key: string): p is TS.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key
    const { call, config } = step
    const inputProp = config.properties.find(p => isProp(p, "input"))
    const inputSchemaProp = config.properties.find(p => isProp(p, "inputSchema"))
    const outputSchemaProp = config.properties.find(p => isProp(p, "outputSchema"))
    const run = config.properties.find(p => isProp(p, "run"))?.initializer

    if (!run || !(ts.isArrowFunction(run) || ts.isFunctionExpression(run))) return null
    if (containsStepCall(ts, config)) throw stepMacroError(sf, call, fileName, "jobStep() and asStep() cannot be nested inside another jobStep(). Await each step separately.")

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

function stepMacroError(sf: TS.SourceFile, node: TS.Node, fileName: string, message: string): Error {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
    return new Error(`${fileName}:${line}: ${message}`)
}

function containsStepCall(ts: typeof TS, node: TS.Node): boolean {
    const walk = (n: TS.Node): true | undefined => (matchStepCall(ts, n) ? true : ts.forEachChild(n, walk))
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
