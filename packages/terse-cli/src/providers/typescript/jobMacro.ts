import type TS from "typescript"

export type MacroJob = { name: string; fnName: string }
export type MacroResult = { code: string; jobs: MacroJob[] }

// Rewrites each `createJob({ onTrigger })` so `onTrigger` becomes a hoisted
// `"use workflow"` function — turning the user's handler into a durable workflow
// without them writing any directive ("createJob adds use workflow for them").
// The raw event is wrapped via `createSDKTrigger` inside the workflow, matching
// the type users already see. Returns the rewritten source plus a job-name ->
// workflow-fn-name map the caller uses to resolve workflowIds from the manifest.
export function transformJobSource(ts: typeof TS, source: string, fileName: string): MacroResult {
    const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const jobs: MacroJob[] = []
    const hoisted: string[] = []
    const edits: Array<{ start: number; end: number; text: string }> = []

    const isProp = (p: TS.ObjectLiteralElementLike, key: string): p is TS.PropertyAssignment =>
        ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === key

    const visit = (node: TS.Node): void => {
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === "createJob" &&
            node.arguments.length > 0 &&
            ts.isObjectLiteralExpression(node.arguments[0])
        ) {
            const obj = node.arguments[0]
            const nameProp = obj.properties.find(p => isProp(p, "name"))
            const onTrigger = obj.properties.find(p => isProp(p, "onTrigger"))
            const jobName = nameProp && ts.isStringLiteralLike(nameProp.initializer) ? nameProp.initializer.text : undefined
            const fn = onTrigger?.initializer

            if (jobName && fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
                const fnName = `terseWf_${Buffer.from(jobName).toString("hex")}`
                const param = fn.parameters.length ? fn.parameters[0].name.getText(sf) : "event"
                const body = ts.isBlock(fn.body) ? fn.body.getText(sf).slice(1, -1) : `\n  return ${fn.body.getText(sf)}\n`
                hoisted.push(
                    `async function ${fnName}(__rawEvent) {\n` +
                        `  "use workflow"\n` +
                        `  const ${param} = createSDKTrigger(__rawEvent)\n` +
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

    if (jobs.length === 0) return { code: source, jobs }

    let code = source
    for (const e of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, e.start) + e.text + code.slice(e.end)
    return { code: injectHoisted(ensureCreateSDKTriggerImport(code), hoisted), jobs }
}

function ensureCreateSDKTriggerImport(code: string): string {
    if (/import\s*\{[^}]*\bcreateSDKTrigger\b[^}]*\}\s*from\s*"terse-sdk"/.test(code)) return code
    if (/import\s*\{([^}]*)\}\s*from\s*"terse-sdk"/.test(code)) {
        return code.replace(/import\s*\{([^}]*)\}\s*from\s*"terse-sdk"/, (_m, g) => `import {${g.trimEnd()}, createSDKTrigger } from "terse-sdk"`)
    }
    return `import { createSDKTrigger } from "terse-sdk"\n${code}`
}

function injectHoisted(code: string, hoisted: string[]): string {
    const lines = code.split("\n")
    let lastImport = -1
    for (let i = 0; i < lines.length; i++) if (/^\s*import\b/.test(lines[i])) lastImport = i
    lines.splice(lastImport + 1, 0, "", "// terse: each onTrigger is hoisted into a durable workflow", ...hoisted.flatMap(h => [h, ""]))
    return lines.join("\n")
}
