import crypto from "node:crypto"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { __buildJobStateAccessor, createSDKTrigger, fetchRegisteredJobs } from "terse-sdk"
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

    const workflowFnByJob = isBuildFresh(out, cwd) ? loadWorkflowArtifacts(out) : await buildWorkflowArtifacts(cwd)

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
            if (!job) throw new Error(`No job was registered with name "${jobName}".`)

            const state = __buildJobStateAccessor(job.states ?? [])
            if (job?.filter && !(await job.filter(createSDKTrigger(event), state))) return { status: "ok", filtered: true }

            process.env.TERSE_BACKEND_URL ??= ctx.apiBaseUrl
            const attributes: Record<string, string> = { sessionId: ctx.sessionId }
            if (ctx.runId) {
                attributes.runId = ctx.runId
            } else {
                attributes.runId = process.env.TERSE_RUN_ID ?? ""
            }
            if (ctx.jobName) attributes.jobName = ctx.jobName
            if (ctx.projectId) attributes.projectId = ctx.projectId

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

const JOBS_MAP_FILE = "jobs.json"

export async function buildWorkflowArtifacts(cwd: string): Promise<Map<string, { fnName: string; file: string }>> {
    const out = path.join(cwd, ".terse", "wf")
    const scanDir = path.join(".terse", "macro")
    const workflowFnByJob = await withMacroedSources(cwd, () => new TerseWorkflowBuilder(cwd, scanDir, out).build())
    fs.writeFileSync(path.join(out, JOBS_MAP_FILE), JSON.stringify([...workflowFnByJob]))
    fs.writeFileSync(path.join(out, SOURCES_HASH_FILE), sourcesHash(cwd))
    return workflowFnByJob
}

const SOURCES_HASH_FILE = "sources.hash"

function isBuildFresh(out: string, cwd: string): boolean {
    const hashFile = path.join(out, SOURCES_HASH_FILE)
    if (!fs.existsSync(path.join(out, JOBS_MAP_FILE)) || !fs.existsSync(path.join(out, "manifest.json")) || !fs.existsSync(hashFile)) return false
    return fs.readFileSync(hashFile, "utf8") === sourcesHash(cwd)
}

function sourcesHash(cwd: string): string {
    const hash = crypto.createHash("sha256")
    for (const file of findSourceFiles(path.join(cwd, "src")).sort()) {
        hash.update(path.relative(cwd, file))
        hash.update(fs.readFileSync(file))
    }
    return hash.digest("hex")
}

function findSourceFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return []
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name !== "node_modules") out.push(...findSourceFiles(p))
        } else if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) {
            out.push(p)
        }
    }
    return out
}

function loadWorkflowArtifacts(out: string): Map<string, { fnName: string; file: string }> {
    return new Map(JSON.parse(fs.readFileSync(path.join(out, JOBS_MAP_FILE), "utf8")))
}

// Macro-transform into a copied dir so the user's `src` is never touched.
async function withMacroedSources(cwd: string, build: () => Promise<void>): Promise<Map<string, { fnName: string; file: string }>> {
    const ts = loadTypescript(cwd)
    const macroDir = path.join(cwd, ".terse", "macro")
    const workflowFnByJob = new Map<string, { fnName: string; file: string }>()

    fs.rmSync(macroDir, { recursive: true, force: true })
    fs.cpSync(path.join(cwd, "src"), macroDir, { recursive: true })

    for (const file of findJobFiles(macroDir)) {
        const { code, stepsCode, jobs } = transformJobSource(ts, fs.readFileSync(file, "utf8"), file)
        if (jobs.length === 0) continue
        fs.writeFileSync(file, code)
        if (stepsCode) fs.writeFileSync(stepsFilePath(file), stepsCode)
        for (const job of jobs) workflowFnByJob.set(job.name, { fnName: job.fnName, file: path.relative(cwd, file) })
    }
    await build()

    return workflowFnByJob
}

function stepsFilePath(file: string): string {
    return file.replace(/\.(ts|tsx|mts|cts)$/, ".__terse.steps.$1")
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
