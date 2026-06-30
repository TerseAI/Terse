import type TS from "typescript"

export type MacroJob = { name: string; fnName: string }
export type MacroResult = { code: string; jobs: MacroJob[] }

// MARK: Rewrite job sources

// Rewrites each `createJob({ onTrigger })` so `onTrigger` becomes a hoisted
// `"use workflow"` function — turning the user's handler into a durable workflow
// without them writing any directive ("createJob adds use workflow for them").
// The raw event is wrapped via `createSDKTrigger` inside the workflow, matching
// the type users already see. Returns the rewritten source plus a job-name ->
// workflow-fn-name map the caller uses to resolve workflowIds from the manifest.
export function transformJobSource(ts: typeof TS, source: string, fileName: string): MacroResult {
    const withSteps = rewriteJobSteps(ts, source, fileName)
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
            const jobName = nameProp && ts.isStringLiteralLike(nameProp.initializer) ? nameProp.initializer.text : undefined
            const fn = onTrigger?.initializer

            if (jobName && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
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

    if (jobs.length === 0) return { code: withSteps, jobs }

    // Inject after the last import's AST end (correct for multi-line imports — a
    // line-based scan would splice into the middle of a `import {\n ... \n} from`).
    const imports = sf.statements.filter(ts.isImportDeclaration)
    const lastImportEnd = imports.length ? imports[imports.length - 1].getEnd() : 0
    edits.push({ start: lastImportEnd, end: lastImportEnd, text: `\n\n// terse: each onTrigger is hoisted into a durable workflow\n${hoisted.join("\n\n")}\n` })

    const importEdit = sdkImportEdit(ts, sf, imports, lastImportEnd, ["createSDKTrigger", "__buildJobStateAccessor"])
    if (importEdit) edits.push(importEdit)

    let code = withSteps
    for (const e of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, e.start) + e.text + code.slice(e.end)
    return { code, jobs }
}

// MARK: Rewrite job steps

// `jobStep(input, fn)` can't run fn as a durable step directly: fn would be a
// serialized step argument, and closures aren't serializable. Rewrite each call so
// fn becomes an inline `"use step"` function (its body compiled into the step bundle,
// its closure vars captured by the compiler) invoked with the input alone. Looped so
// nested jobStep calls are rewritten once the enclosing one is.
function rewriteJobSteps(ts: typeof TS, source: string, fileName: string): string {
    let code = source
    while (true) {
        const next = rewriteJobStepsOnce(ts, code, fileName)
        if (next === code) return code
        code = next
    }
}

function rewriteJobStepsOnce(ts: typeof TS, source: string, fileName: string): string {
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const edits: Array<{ start: number; end: number; text: string }> = []

    const visit = (node: TS.Node): void => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "jobStep" && node.arguments.length >= 2) {
            const [inputArg, fnArg] = node.arguments
            if (ts.isArrowFunction(fnArg) || ts.isFunctionExpression(fnArg)) {
                const call = `(${stepFunctionText(ts, sf, fnArg)})(${inputArg.getText(sf)})`
                const text = ts.isExpressionStatement(node.parent) ? `;${call}` : call
                edits.push({ start: node.getStart(sf), end: node.getEnd(), text })
                return
            }
        }
        ts.forEachChild(node, visit)
    }
    visit(sf)

    if (edits.length === 0) return source
    let code = source
    for (const e of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, e.start) + e.text + code.slice(e.end)
    return code
}

function stepFunctionText(ts: typeof TS, sf: TS.SourceFile, fn: TS.ArrowFunction | TS.FunctionExpression): string {
    const asyncKw = fn.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword) ? "async " : ""
    const params = fn.parameters.map(p => p.getText(sf)).join(", ")
    const body = ts.isBlock(fn.body) ? fn.body.getText(sf).slice(1, -1) : `\n  return ${fn.body.getText(sf)}\n`
    return `${asyncKw}(${params}) => {\n  "use step"\n${body}}`
}

// Adds the given names to an existing `terse-sdk` named import, or a fresh import
// line if there is none. Returns null when all names are already imported.
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
