import path from "node:path"
import type TS from "typescript"

export type MacroJob = { name: string; fnName: string }
export type MacroResult = { code: string; stepsCode: string | null; jobs: MacroJob[] }

// MARK: Rewrite job sources

export function transformJobSource(ts: typeof TS, source: string, fileName: string): MacroResult {
    const { code: withSteps, stepDefs } = extractJobSteps(ts, source, fileName)
    const sf = ts.createSourceFile(fileName, withSteps, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const jobs: MacroJob[] = []
    const hoisted: string[] = []
    const edits: Array<{ start: number; end: number; text: string }> = []

    const isProp = (p: TS.ObjectLiteralElementLike, key: string): p is TS.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key

    const visit = (node: TS.Node): void => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "createJob" && node.arguments.length > 0 && ts.isObjectLiteralExpression(node.arguments[0])) {
            const obj = node.arguments[0]
            const nameProp = obj.properties.find(p => isProp(p, "name"))
            const onTrigger = obj.properties.find(p => isProp(p, "onTrigger"))
            const statesProp = obj.properties.find(p => isProp(p, "states"))
            const durable = obj.properties.find(p => isProp(p, "durable"))?.initializer.kind === ts.SyntaxKind.TrueKeyword
            const jobName = nameProp && ts.isStringLiteralLike(nameProp.initializer) ? nameProp.initializer.text : undefined
            const fn = onTrigger?.initializer

            if (jobName && fn && durable && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
                const fnName = `terseWf_${Buffer.from(jobName).toString("hex")}`
                const param = fn.parameters.length ? fn.parameters[0].name.getText(sf) : "event"
                const stateParam = fn.parameters.length > 1 ? fn.parameters[1].name.getText(sf) : "state"
                const statesText = statesProp ? statesProp.initializer.getText(sf) : "[]"
                const body = ts.isBlock(fn.body) ? fn.body.getText(sf).slice(1, -1) : `\n  return ${fn.body.getText(sf)}\n`
                hoisted.push(
                    `async function ${fnName}(__rawEvent) {\n` +
                        `  "use workflow"\n` +
                        `  const ${param} = createSDKTrigger(__rawEvent)\n` +
                        `  const ${stateParam} = __buildJobStateAccessor(${statesText})\n` +
                        body +
                        `}`
                )
                edits.push({ start: onTrigger!.getStart(sf), end: onTrigger!.getEnd(), text: `onTrigger: ${fnName}` })
                jobs.push({ name: jobName, fnName })
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sf)

    if (jobs.length === 0) return { code: withSteps, stepsCode: null, jobs }

    const imports = sf.statements.filter(ts.isImportDeclaration)
    const lastImportEnd = imports.length ? imports[imports.length - 1].getEnd() : 0
    edits.push({ start: lastImportEnd, end: lastImportEnd, text: `\n\n${hoisted.join("\n\n")}\n` })

    const importEdit = sdkImportEdit(ts, sf, imports, lastImportEnd, ["createSDKTrigger", "__buildJobStateAccessor"])
    if (importEdit) edits.push(importEdit)

    if (stepDefs.length > 0) {
        edits.push({ start: lastImportEnd, end: lastImportEnd, text: `\nimport { ${stepDefs.map(s => s.name).join(", ")} } from "${stepsImportSpecifier(fileName)}"` })
    }

    let code = withSteps
    for (const e of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, e.start) + e.text + code.slice(e.end)

    const stepsCode = stepDefs.length > 0 ? buildStepsModule(ts, sf, imports, stepDefs) : null
    return { code, stepsCode, jobs }
}

// MARK: Extract job steps

type StepDef = { name: string; def: string }

function extractJobSteps(ts: typeof TS, source: string, fileName: string): { code: string; stepDefs: StepDef[] } {
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const stepDefs: StepDef[] = []
    const edits: Array<{ start: number; end: number; text: string }> = []
    const isProp = (p: TS.ObjectLiteralElementLike, key: string): p is TS.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key
    let counter = 0

    const visit = (node: TS.Node): void => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "jobStep" && node.arguments.length > 0 && ts.isObjectLiteralExpression(node.arguments[0])) {
            const obj = node.arguments[0]
            const inputProp = obj.properties.find(p => isProp(p, "input"))
            const inputSchemaProp = obj.properties.find(p => isProp(p, "inputSchema"))
            const outputSchemaProp = obj.properties.find(p => isProp(p, "outputSchema"))
            const run = obj.properties.find(p => isProp(p, "run"))?.initializer

            if (run && (ts.isArrowFunction(run) || ts.isFunctionExpression(run))) {
                const name = `terseStep_${counter++}`
                stepDefs.push({ name, def: stepFunctionText(ts, sf, name, run, inputSchemaProp?.initializer, outputSchemaProp?.initializer) })
                edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `${name}(${inputProp ? inputProp.initializer.getText(sf) : ""})` })
                return
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sf)

    if (edits.length === 0) return { code: source, stepDefs: [] }
    let code = source
    for (const e of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, e.start) + e.text + code.slice(e.end)
    return { code, stepDefs }
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

function buildStepsModule(ts: typeof TS, sf: TS.SourceFile, imports: TS.ImportDeclaration[], stepDefs: StepDef[]): string {
    const importLines = imports.map(i => i.getText(sf)).join("\n")
    const defs = stepDefs.map(s => s.def).join("\n\n")
    return `${importLines}\n\n${defs}\n`
}

function stepsImportSpecifier(fileName: string): string {
    return `./${path.basename(fileName).replace(/\.(ts|tsx|mts|cts)$/, "")}.__terse.steps`
}

// MARK: Imports

function sdkImportEdit(ts: typeof TS, sf: TS.SourceFile, imports: TS.ImportDeclaration[], lastImportEnd: number, names: string[]): { start: number; end: number; text: string } | null {
    const sdkImport = imports.find(i => ts.isStringLiteralLike(i.moduleSpecifier) && i.moduleSpecifier.text === "terse-sdk")
    const named = sdkImport?.importClause?.namedBindings
    if (sdkImport && named && ts.isNamedImports(named)) {
        const missing = names.filter(n => !named.elements.some(el => el.name.text === n))
        if (missing.length === 0) return null
        const lastElement = named.elements[named.elements.length - 1]
        if (lastElement) {
            const pos = lastElement.getEnd()
            return { start: pos, end: pos, text: `, ${missing.join(", ")}` }
        }
    }
    return { start: lastImportEnd, end: lastImportEnd, text: `\nimport { ${names.join(", ")} } from "terse-sdk"` }
}
