import path from "node:path"
import type TS from "typescript"

import { StepCallKind, type StepDef, type StepEdit, findStepImportName, matchStepCall, transformJobStep, transformStep } from "./stepMacro.js"

export type MacroJob = { name: string; fnName: string }
export type MacroResult = { code: string; stepsCode: string | null; jobs: MacroJob[] }

// MARK: Rewrite job sources

export function transformJobSource(ts: typeof TS, source: string, fileName: string): MacroResult {
    const { code: withSteps, stepDefs } = extractJobSteps(ts, source, fileName)
    const sf = ts.createSourceFile(fileName, withSteps, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const jobs: MacroJob[] = []
    const hoisted: string[] = []
    const edits: StepEdit[] = []

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
                const ctxParam = fn.parameters.length > 2 ? fn.parameters[2].name.getText(sf) : undefined
                const statesText = statesProp ? statesProp.initializer.getText(sf) : "[]"
                const body = ts.isBlock(fn.body) ? fn.body.getText(sf).slice(1, -1) : `\n  return ${fn.body.getText(sf)}\n`
                hoisted.push(
                    `async function ${fnName}(__rawEvent, __rawTunnelCtx) {\n` +
                        `  "use workflow"\n` +
                        `  const ${param} = createSDKTrigger(__rawEvent)\n` +
                        `  const ${stateParam} = __buildJobStateAccessor(${statesText})\n` +
                        (ctxParam ? `  const ${ctxParam} = __rawTunnelCtx\n` : "") +
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

    const stepsCode = stepDefs.length > 0 ? buildStepsModule(ts, sf, stepDefs) : null
    return { code, stepsCode, jobs }
}

// MARK: Extract job steps

function extractJobSteps(ts: typeof TS, source: string, fileName: string): { code: string; stepDefs: StepDef[] } {
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const stepDefs: StepDef[] = []
    const edits: StepEdit[] = []
    const stepName = findStepImportName(ts, sf)
    let counter = 0

    const visit = (node: TS.Node): void => {
        const step = matchStepCall(ts, node, stepName)
        if (step) {
            switch (step.kind) {
                case StepCallKind.Step: {
                    const { stepDef, edit } = transformStep(ts, sf, step, fileName, counter++, stepName)
                    stepDefs.push(stepDef)
                    edits.push(edit)
                    return
                }
                case StepCallKind.JobStep: {
                    const transformed = transformJobStep(ts, sf, step, fileName, counter, stepName)
                    if (transformed) {
                        counter++
                        stepDefs.push(transformed.stepDef)
                        edits.push(transformed.edit)
                        return
                    }
                    break
                }
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

// Steps execute from a separate bundle, so the module scope the hoisted code relies
// on (clients, env guards, helpers) must exist there too, not just the imports.
function buildStepsModule(ts: typeof TS, sf: TS.SourceFile, stepDefs: StepDef[]): string {
    const moduleCode = sf.statements
        .filter(s => !containsCreateJob(ts, s))
        .map(s => s.getText(sf))
        .join("\n")
    const defs = stepDefs.map(s => s.def).join("\n\n")
    return `${moduleCode}\n\n${defs}\n`
}

function containsCreateJob(ts: typeof TS, node: TS.Node): boolean {
    const walk = (n: TS.Node): true | undefined => (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "createJob" ? true : ts.forEachChild(n, walk))
    return walk(node) ?? false
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
