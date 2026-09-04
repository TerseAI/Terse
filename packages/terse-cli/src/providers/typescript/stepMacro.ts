import type TS from "typescript"

export type StepEdit = { start: number; end: number; text: string }

export function findStepImportName(ts: typeof TS, sf: TS.SourceFile): string | null {
    for (const statement of sf.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier) || statement.moduleSpecifier.text !== "terse-sdk") continue
        const named = statement.importClause?.namedBindings
        if (!named || !ts.isNamedImports(named)) continue
        const element = named.elements.find(candidate => (candidate.propertyName ?? candidate.name).text === "step")
        if (element) return element.name.text
    }
    return null
}

export function matchStepCall(ts: typeof TS, node: TS.Node, stepName: string | null): TS.CallExpression | null {
    if (!stepName || !ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== stepName) return null
    return node
}

export function transformStep(ts: typeof TS, sf: TS.SourceFile, call: TS.CallExpression, fileName: string, index: number): StepEdit {
    const inner = call.arguments.length === 1 ? call.arguments[0] : undefined
    if (!inner) throw stepMacroError(sf, call, fileName, "step() takes exactly one argument: a direct call, e.g. step(client.method(args)).")
    if (!ts.isCallExpression(inner)) {
        throw stepMacroError(sf, call, fileName, "step() must wrap a direct call, e.g. step(client.method(args)). Storing the promise in a variable first is not supported.")
    }
    if (containsStepCall(ts, inner, ts.isIdentifier(call.expression) ? call.expression.text : null)) {
        throw stepMacroError(sf, call, fileName, "Steps cannot be nested inside a step() call. Await each step separately.")
    }

    const calleeNames: string[] = []
    let calleeRoot: TS.Expression = inner.expression
    while (ts.isPropertyAccessExpression(calleeRoot)) {
        calleeNames.unshift(calleeRoot.name.text)
        calleeRoot = calleeRoot.expression
    }
    if (!ts.isIdentifier(calleeRoot)) {
        throw stepMacroError(sf, call, fileName, "step() requires a plain property path like step(client.method(args)). Computed access and intermediate calls are not supported.")
    }
    calleeNames.unshift(calleeRoot.text)

    for (const argument of inner.arguments) {
        const functionValue = findLiteralFunctionArgument(ts, argument)
        if (functionValue) {
            throw stepMacroError(sf, functionValue, fileName, "A function cannot cross the durable step input boundary. Move the callback inside a helper and wrap that helper call in step().")
        }
    }

    const callee = inner.expression.getText(sf)
    const args = inner.arguments.map(argument => argument.getText(sf)).join(", ")
    const name = `${calleeNames.join(".")}:${index}`
    const text = `__runDurableStep({ name: "${name}", input: [${args}] as const, run: async (__terseArgs) => await ${callee}(...__terseArgs) })`

    return { start: call.getStart(sf), end: call.getEnd(), text }
}

function containsStepCall(ts: typeof TS, node: TS.Node, stepName: string | null): boolean {
    const visit = (candidate: TS.Node): true | undefined => {
        if (matchStepCall(ts, candidate, stepName)) return true
        return ts.forEachChild(candidate, visit)
    }
    return ts.forEachChild(node, visit) ?? false
}

function findLiteralFunctionArgument(ts: typeof TS, node: TS.Node): TS.Node | null {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return node
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return findLiteralFunctionArgument(ts, node.expression)
    if (ts.isObjectLiteralExpression(node)) {
        for (const property of node.properties) {
            if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) return property
            if (ts.isPropertyAssignment(property)) {
                const found = findLiteralFunctionArgument(ts, property.initializer)
                if (found) return found
            }
        }
    }
    if (ts.isArrayLiteralExpression(node)) {
        for (const element of node.elements) {
            const found = findLiteralFunctionArgument(ts, element)
            if (found) return found
        }
    }
    return null
}

function stepMacroError(sf: TS.SourceFile, node: TS.Node, fileName: string, message: string): Error {
    const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
    return new Error(`${fileName}:${line}: ${message}`)
}
