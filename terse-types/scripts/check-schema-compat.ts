import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

type Issue = {
    file: string
    line: number
    column: number
    message: string
}

const packageRoot = fileURLToPath(new URL("..", import.meta.url))
const passthroughMethods = new Set(["brand", "default", "describe", "nullable", "nullish", "optional", "readonly"])
const nestedTransformMethods = new Set(["extend", "merge", "omit", "partial", "pick", "required"])

async function main() {
    const sourceFiles = await loadSourceFiles()
    const issues = sourceFiles.flatMap(sourceFile => collectIssues(sourceFile))

    if (issues.length === 0) {
        console.log("[check-schema-compat] No inline schema compatibility issues found.")
        return
    }

    for (const issue of issues) {
        console.error(`${issue.file}:${issue.line}:${issue.column} ${issue.message}`)
    }

    console.error(
        `\n[check-schema-compat] Found ${issues.length} issue${issues.length === 1 ? "" : "s"}. Hoist nested object/transform schemas into named top-level *Schema constants so JSON Schema export can emit stable $refs.`
    )
    process.exitCode = 1
}

async function loadSourceFiles(): Promise<ts.SourceFile[]> {
    const entries = await readdir(packageRoot, { withFileTypes: true })
    const rootTsFiles = entries.filter(entry => entry.isFile() && entry.name.endsWith(".ts")).map(entry => path.join(packageRoot, entry.name))

    return Promise.all(
        rootTsFiles.map(async filePath => {
            const sourceText = await readFile(filePath, "utf8")
            return ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
        })
    )
}

function collectIssues(sourceFile: ts.SourceFile): Issue[] {
    const issues: Issue[] = []

    for (const statement of sourceFile.statements) {
        if (!ts.isVariableStatement(statement)) continue

        for (const declaration of statement.declarationList.declarations) {
            if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue

            const declarationName = declaration.name.text
            const toolObject = getDefineToolObjectLiteral(declaration.initializer)
            if (toolObject) {
                for (const property of toolObject.properties) {
                    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue
                    if (property.name.text !== "inputSchema" && property.name.text !== "outputSchema") continue
                    inspectRootExpression(property.initializer, `${declarationName}.${property.name.text}`, sourceFile, issues)
                }
                continue
            }

            if (!declarationName.endsWith("Schema")) continue
            inspectRootExpression(declaration.initializer, declarationName, sourceFile, issues)
        }
    }

    return issues
}

function inspectRootExpression(expression: ts.Expression, owner: string, sourceFile: ts.SourceFile, issues: Issue[]): void {
    const root = unwrapExpression(expression)

    if (ts.isCallExpression(root) && isZodObjectCall(root)) {
        inspectObjectShape(root.arguments[0], owner, sourceFile, issues)
        return
    }

    if (ts.isCallExpression(root) && isSchemaMethodCall(root, "extend")) {
        inspectObjectShape(root.arguments[0], owner, sourceFile, issues)
        return
    }

    if (ts.isCallExpression(root) && isUnionLikeCall(root)) {
        for (const member of getUnionMembers(root)) {
            inspectNestedExpression(member, owner, sourceFile, issues)
        }
        return
    }

    if (ts.isCallExpression(root) && isZodArrayCall(root) && root.arguments[0]) {
        inspectNestedExpression(root.arguments[0], owner, sourceFile, issues)
        return
    }

    if (ts.isCallExpression(root) && isZodRecordCall(root) && root.arguments[1]) {
        inspectNestedExpression(root.arguments[1], owner, sourceFile, issues)
    }
}

function inspectObjectShape(shape: ts.Expression | undefined, owner: string, sourceFile: ts.SourceFile, issues: Issue[]): void {
    if (!shape || !ts.isObjectLiteralExpression(shape)) return

    for (const property of shape.properties) {
        if (!ts.isPropertyAssignment(property)) continue
        inspectNestedExpression(property.initializer, `${owner}.${property.name.getText(sourceFile)}`, sourceFile, issues)
    }
}

function inspectNestedExpression(expression: ts.Expression, owner: string, sourceFile: ts.SourceFile, issues: Issue[]): void {
    const unwrapped = unwrapExpression(expression)

    if (ts.isCallExpression(unwrapped) && isNestedTransformCall(unwrapped)) {
        addIssue(issues, sourceFile, unwrapped, `Inline schema transform in ${owner}. Hoist this into a named top-level *Schema constant and reuse it here.`)
        return
    }

    if (ts.isCallExpression(unwrapped) && isZodObjectCall(unwrapped)) {
        addIssue(issues, sourceFile, unwrapped, `Inline anonymous object schema in ${owner}. Hoist this object into a named top-level *Schema constant and reuse it here.`)
        return
    }

    if (ts.isCallExpression(unwrapped) && isUnionLikeCall(unwrapped)) {
        for (const member of getUnionMembers(unwrapped)) {
            inspectNestedExpression(member, owner, sourceFile, issues)
        }
        return
    }

    if (ts.isCallExpression(unwrapped) && isZodArrayCall(unwrapped) && unwrapped.arguments[0]) {
        inspectNestedExpression(unwrapped.arguments[0], owner, sourceFile, issues)
        return
    }

    if (ts.isCallExpression(unwrapped) && isZodRecordCall(unwrapped) && unwrapped.arguments[1]) {
        inspectNestedExpression(unwrapped.arguments[1], owner, sourceFile, issues)
    }
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
    let current = expression

    while (true) {
        if (ts.isParenthesizedExpression(current)) {
            current = current.expression
            continue
        }

        if (ts.isAsExpression(current) || ts.isTypeAssertionExpression(current)) {
            current = current.expression
            continue
        }

        if (ts.isSatisfiesExpression?.(current)) {
            current = current.expression
            continue
        }

        if (!ts.isCallExpression(current)) {
            return current
        }

        if (isPassthroughMethodCall(current)) {
            current = current.expression.expression
            continue
        }

        if (isZodLazyCall(current)) {
            const lazyBody = getArrowBodyExpression(current.arguments[0])
            if (lazyBody) {
                current = lazyBody
                continue
            }
        }

        return current
    }
}

function getDefineToolObjectLiteral(expression: ts.Expression): ts.ObjectLiteralExpression | null {
    if (!ts.isCallExpression(expression)) return null
    if (!ts.isIdentifier(expression.expression) || expression.expression.text !== "defineTool") return null

    const [firstArg] = expression.arguments
    return firstArg && ts.isObjectLiteralExpression(firstArg) ? firstArg : null
}

function isPassthroughMethodCall(expression: ts.CallExpression): expression is ts.CallExpression & { expression: ts.PropertyAccessExpression } {
    return ts.isPropertyAccessExpression(expression.expression) && passthroughMethods.has(expression.expression.name.text)
}

function isNestedTransformCall(expression: ts.CallExpression): expression is ts.CallExpression & { expression: ts.PropertyAccessExpression } {
    return ts.isPropertyAccessExpression(expression.expression) && nestedTransformMethods.has(expression.expression.name.text)
}

function isSchemaMethodCall(expression: ts.CallExpression, methodName: string): expression is ts.CallExpression & { expression: ts.PropertyAccessExpression } {
    return ts.isPropertyAccessExpression(expression.expression) && expression.expression.name.text === methodName
}

function isZodCall(expression: ts.CallExpression, methodName: string): boolean {
    return (
        ts.isPropertyAccessExpression(expression.expression) &&
        ts.isIdentifier(expression.expression.expression) &&
        expression.expression.expression.text === "z" &&
        expression.expression.name.text === methodName
    )
}

function isZodObjectCall(expression: ts.CallExpression): boolean {
    return isZodCall(expression, "object")
}

function isZodArrayCall(expression: ts.CallExpression): boolean {
    return isZodCall(expression, "array")
}

function isZodRecordCall(expression: ts.CallExpression): boolean {
    return isZodCall(expression, "record")
}

function isZodLazyCall(expression: ts.CallExpression): boolean {
    return isZodCall(expression, "lazy")
}

function isUnionLikeCall(expression: ts.CallExpression): boolean {
    return isZodCall(expression, "union") || isZodCall(expression, "discriminatedUnion")
}

function getUnionMembers(expression: ts.CallExpression): ts.Expression[] {
    const arrayArg = isZodCall(expression, "union") ? expression.arguments[0] : expression.arguments[1]
    return arrayArg && ts.isArrayLiteralExpression(arrayArg) ? [...arrayArg.elements] : []
}

function getArrowBodyExpression(argument: ts.Expression | undefined): ts.Expression | null {
    if (!argument || !ts.isArrowFunction(argument)) return null
    return ts.isBlock(argument.body) ? null : argument.body
}

function addIssue(issues: Issue[], sourceFile: ts.SourceFile, node: ts.Node, message: string): void {
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
    issues.push({
        file: path.relative(packageRoot, sourceFile.fileName),
        line: line + 1,
        column: character + 1,
        message
    })
}

void main().catch(error => {
    console.error("[check-schema-compat] Failed.")
    console.error(error)
    process.exitCode = 1
})
