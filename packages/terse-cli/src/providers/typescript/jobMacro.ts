import type TS from "typescript"

import { findStepImportName, matchStepCall, transformStep } from "./stepMacro.js"

export type MacroJob = { name: string }
export type MacroResult = { code: string; stepsCode: null; jobs: MacroJob[] }

export function transformJobSource(ts: typeof TS, source: string, fileName: string): MacroResult {
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const stepName = findStepImportName(ts, sf)
    const stepEdits: Array<{ start: number; end: number; text: string }> = []
    let stepIndex = 0

    const visit = (node: TS.Node): void => {
        const step = matchStepCall(ts, node, stepName)
        if (step) {
            stepEdits.push(transformStep(ts, sf, step, fileName, stepIndex++))
            return
        }

        ts.forEachChild(node, visit)
    }
    visit(sf)

    let code = applyEdits(source, stepEdits)
    const hoisted = hoistDurableJobs(ts, code, fileName)
    code = hoisted.code

    const sdkImports = [...(stepIndex > 0 ? ["__runDurableStep"] : []), ...(hoisted.jobs.length > 0 ? ["__defineTerseWorkflow", "__registerDurableWorkflow"] : [])]
    code = addSdkImports(ts, code, fileName, sdkImports)

    return { code, stepsCode: null, jobs: hoisted.jobs }
}

function hoistDurableJobs(ts: typeof TS, source: string, fileName: string): { code: string; jobs: MacroJob[] } {
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const edits: Array<{ start: number; end: number; text: string }> = []
    const jobs: MacroJob[] = []

    for (const statement of sf.statements) {
        if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue
        const name = durableJobName(ts, statement.expression)
        if (!name) continue

        const index = jobs.length
        const jobName = `__terseJob${index}`
        const workflowName = `__terseWorkflow${index}`
        edits.push({
            start: statement.getStart(sf),
            end: statement.getEnd(),
            text: `const ${jobName} = ${statement.expression.getText(sf)}\nconst ${workflowName} = __defineTerseWorkflow(${jobName})\n__registerDurableWorkflow(${workflowName})`
        })
        jobs.push({ name })
    }

    return { code: applyEdits(source, edits), jobs }
}

function durableJobName(ts: typeof TS, node: TS.Node): string | undefined {
    if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== "createJob") return undefined
    const [config] = node.arguments
    if (!config || !ts.isObjectLiteralExpression(config)) return undefined

    const name = property(ts, config, "name")?.initializer
    const durable = property(ts, config, "durable")?.initializer

    if (!name || !ts.isStringLiteralLike(name) || durable?.kind !== ts.SyntaxKind.TrueKeyword) return undefined
    return name.text
}

function property(ts: typeof TS, object: TS.ObjectLiteralExpression, name: string): TS.PropertyAssignment | undefined {
    return object.properties.find((candidate): candidate is TS.PropertyAssignment => ts.isPropertyAssignment(candidate) && ts.isIdentifier(candidate.name) && candidate.name.text === name)
}

function addSdkImports(ts: typeof TS, source: string, fileName: string, names: readonly string[]): string {
    if (names.length === 0) return source
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const imports = sf.statements.filter(ts.isImportDeclaration)
    const sdkImport = imports.find(statement => ts.isStringLiteralLike(statement.moduleSpecifier) && statement.moduleSpecifier.text === "terse-sdk")
    const bindings = sdkImport?.importClause?.namedBindings

    if (bindings && ts.isNamedImports(bindings)) {
        const importedNames = new Set(bindings.elements.map(element => (element.propertyName ?? element.name).text))
        const missingNames = names.filter(name => !importedNames.has(name))
        if (missingNames.length === 0) return source
        const lastElement = bindings.elements[bindings.elements.length - 1]
        if (lastElement) return applyEdits(source, [{ start: lastElement.getEnd(), end: lastElement.getEnd(), text: `, ${missingNames.join(", ")}` }])
    }

    const lastImportEnd = imports.length > 0 ? imports[imports.length - 1]!.getEnd() : 0
    return applyEdits(source, [{ start: lastImportEnd, end: lastImportEnd, text: `\nimport { ${names.join(", ")} } from "terse-sdk"` }])
}

function applyEdits(source: string, edits: ReadonlyArray<{ start: number; end: number; text: string }>): string {
    let code = source
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
        code = code.slice(0, edit.start) + edit.text + code.slice(edit.end)
    }
    return code
}
