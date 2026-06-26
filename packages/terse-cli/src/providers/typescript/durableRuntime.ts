import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { createSDKTrigger, fetchRegisteredJobs } from "terse-sdk"
import { TerseJobContext } from "terse-sdk/dist/context"
import { SerializedEvent } from "terse-types"
import { getRun, start } from "workflow/api"
import { setWorld } from "workflow/runtime"

import { createTerseWorld } from "../../terseWorld.js"

import { transformJobSource } from "./jobMacro.js"
import { TerseWorkflowBuilder } from "./terseWorkflowBuilder.js"

let runtimePromise: Promise<DurableRuntime> | null = null

export function getDurableRuntime(cwd = process.cwd()): Promise<DurableRuntime> {
    return (runtimePromise ??= startDurableRuntime(cwd))
}

async function startDurableRuntime(cwd: string): Promise<DurableRuntime> {
    const out = path.join(cwd, ".terse", "wf")

    // Macro pass (in place): rewrite each createJob's onTrigger into a hoisted
    // "use workflow" function directly in the user's source, build, then restore
    // the originals. The build discovers the injected workflows straight from the
    // user's module — no generated dispatcher, no runtime registry, no realm
    // boundary to cross. Restore always runs (finally) so a build error leaves
    // the sources untouched.
    const workflowFnByJob = await withMacroedSources(cwd, () => new TerseWorkflowBuilder(cwd, "src", out).build())

    const world = createTerseWorld()
    setWorld(world)

    const require = createRequire(import.meta.url)
    world.registerHandler("__wkf_step_", require(path.join(out, "steps.cjs")).POST)
    world.registerHandler("__wkf_workflow_", require(path.join(out, "workflows.cjs")).POST)

    // start() re-enqueues recovered (pending/running) runs from .terse/data, so the
    // handlers must already be registered or there is nothing to drain them.
    await world.start?.()

    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"))
    const workflowIdByJob = new Map<string, string>()
    const missing: Array<{ name: string; file: string }> = []
    for (const [name, { fnName, file }] of workflowFnByJob) {
        const workflowId = lookupWorkflowId(manifest, fnName)
        if (workflowId) workflowIdByJob.set(name, workflowId)
        else missing.push({ name, file })
    }
    if (missing.length > 0) {
        const lines = missing.map(m => `  - "${m.name}" (${m.file})`).join("\n")
        throw new Error(
            `The durable build produced no "use workflow" for ${missing.length} job(s):\n${lines}\n\nEach file was transformed but its workflow never reached the manifest, which almost always means the file failed to compile during the bundle. Check that each file builds on its own, then re-run.`
        )
    }

    return {
        dispatchJob: async (jobName, ctx, event) => {
            const workflowId = workflowIdByJob.get(jobName)
            if (!workflowId) throw new Error(`No durable workflow was built for job "${jobName}".`)

            const job = fetchRegisteredJobs().get(jobName)
            if (job?.filter && !(await job.filter(createSDKTrigger(event)))) return { status: "ok", filtered: true }

            process.env.TERSE_BACKEND_URL ??= ctx.apiBaseUrl
            const attributes: Record<string, string> = { sessionId: ctx.sessionId }
            if (ctx.runId) attributes.runId = ctx.runId
            const run = await start({ workflowId }, [event], { attributes })
            return await run.returnValue
        },
        resumeRun: workflowRunId => getRun(workflowRunId).returnValue,
        close: () => world.close?.() ?? Promise.resolve()
    }
}

type DurableRuntime = {
    dispatchJob: (jobName: string, ctx: TerseJobContext, event: SerializedEvent) => Promise<unknown>
    resumeRun: (workflowRunId: string) => Promise<unknown>
    close: () => Promise<void>
}

function lookupWorkflowId(manifest: any, fnName: string): string | undefined {
    for (const fileEntry of Object.values<any>(manifest.workflows ?? {})) {
        const fn = fileEntry[fnName]
        if (fn?.workflowId) return fn.workflowId
    }
    return undefined
}

// Transform every createJob source file in place, run `build`, then restore the
// originals (always — via finally). Returns the job-name -> workflow-fn map.
async function withMacroedSources(cwd: string, build: () => Promise<void>): Promise<Map<string, { fnName: string; file: string }>> {
    const ts = loadTypescript(cwd)
    const backups = new Map<string, string>()
    const workflowFnByJob = new Map<string, { fnName: string; file: string }>()

    try {
        for (const file of findJobFiles(path.join(cwd, "src"))) {
            const original = fs.readFileSync(file, "utf8")
            const { code, jobs } = transformJobSource(ts, original, file)
            if (jobs.length === 0) continue
            backups.set(file, original)
            fs.writeFileSync(file, code)
            for (const job of jobs) workflowFnByJob.set(job.name, { fnName: job.fnName, file: path.relative(cwd, file) })
        }
        await build()
    } finally {
        for (const [file, original] of backups) fs.writeFileSync(file, original)
    }

    return workflowFnByJob
}

function findJobFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return []
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules") out.push(...findJobFiles(p))
        } else if (/\.(ts|tsx|mts|cts)$/.test(entry.name) && fs.readFileSync(p, "utf8").includes("createJob")) {
            out.push(p)
        }
    }
    return out
}

function loadTypescript(cwd: string): typeof import("typescript") {
    try {
        return createRequire(path.join(cwd, "package.json"))("typescript")
    } catch {
        throw new Error("Durable execution needs TypeScript in your project. Run: npm install --save-dev typescript")
    }
}
