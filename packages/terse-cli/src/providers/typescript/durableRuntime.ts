import { createLocalWorld } from "@workflow/world-local"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { createSDKTrigger, fetchRegisteredJobs } from "terse-sdk"
import { TerseJobContext } from "terse-sdk/dist/context"
import { SerializedEvent } from "terse-types"
import { start } from "workflow/api"
import { setWorld } from "workflow/runtime"

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

    const world = createLocalWorld({ dataDir: path.join(cwd, ".terse", "data"), recoverActiveRuns: false })
    await world.start?.()
    setWorld(world)

    const require = createRequire(import.meta.url)
    world.registerHandler("__wkf_step_", require(path.join(out, "steps.cjs")).POST)
    world.registerHandler("__wkf_workflow_", require(path.join(out, "workflows.cjs")).POST)

    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"))
    const workflowIdByJob = new Map([...workflowFnByJob].map(([name, fnName]) => [name, findWorkflowId(manifest, fnName)]))

    return {
        dispatchJob: async (jobName, ctx, event) => {
            const workflowId = workflowIdByJob.get(jobName)
            if (!workflowId) throw new Error(`No durable workflow was built for job "${jobName}".`)

            const job = fetchRegisteredJobs().get(jobName)
            if (job?.filter && !(await job.filter(createSDKTrigger(event)))) return { status: "ok", filtered: true }

            process.env.TERSE_BACKEND_URL ??= ctx.apiBaseUrl
            const attributes: Record<string, string> = { sessionId: ctx.sessionId }
            if (ctx.runId) attributes.runId = ctx.runId
            return start({ workflowId }, [event], { attributes })
        },
        close: () => world.close?.() ?? Promise.resolve()
    }
}

type DurableRuntime = {
    dispatchJob: (jobName: string, ctx: TerseJobContext, event: SerializedEvent) => Promise<unknown> // tighten to the workflow Run type once you await completion
    close: () => Promise<void>
}

function findWorkflowId(manifest: any, fnName: string): string {
    for (const fileEntry of Object.values<any>(manifest.workflows ?? {})) {
        const fn = fileEntry[fnName]
        if (fn?.workflowId) return fn.workflowId
    }
    throw new Error(`Workflow "${fnName}" not found in manifest — was the job macro applied before the build?`)
}

// Transform every createJob source file in place, run `build`, then restore the
// originals (always — via finally). Returns the job-name -> workflow-fn map.
async function withMacroedSources(cwd: string, build: () => Promise<void>): Promise<Map<string, string>> {
    const ts = loadTypescript(cwd)
    const backups = new Map<string, string>()
    const workflowFnByJob = new Map<string, string>()

    try {
        for (const file of findJobFiles(path.join(cwd, "src"))) {
            const original = fs.readFileSync(file, "utf8")
            const { code, jobs } = transformJobSource(ts, original, file)
            if (jobs.length === 0) continue
            backups.set(file, original)
            fs.writeFileSync(file, code)
            for (const job of jobs) workflowFnByJob.set(job.name, job.fnName)
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
