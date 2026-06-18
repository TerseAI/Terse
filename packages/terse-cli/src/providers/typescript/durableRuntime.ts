import { createLocalWorld } from "@workflow/world-local"
import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fetchRegisteredJobs } from "terse-sdk"
import { TerseJobContext } from "terse-sdk/dist/context"
import { SerializedEvent } from "terse-types"
import { start } from "workflow/api"
import { setWorld } from "workflow/runtime"

import { TerseWorkflowBuilder } from "./terseWorkflowBuilder.js"

let runtimePromise: Promise<DurableRuntime> | null = null

export function getDurableRuntime(cwd = process.cwd(), entryFile?: string): Promise<DurableRuntime> {
    // memoize: first event in `listen` builds; subsequent events reuse
    return (runtimePromise ??= startDurableRuntime(cwd, entryFile))
}

async function startDurableRuntime(cwd: string, entryFile?: string): Promise<DurableRuntime> {
    const out = path.join(cwd, ".terse", "wf")

    // The "use workflow" dispatcher must live in SCANNED project source: the
    // builder discovers directives by scanning the project and excludes
    // node_modules, so it can't find one inside terse-sdk. Write it next to the
    // user's job entry just for the build, then remove it — the directive ends
    // up compiled into workflows.cjs, so the temp source isn't needed after.
    const { file: dispatcherFile, workflowFns } = writeDispatcherFile(cwd, entryFile)
    try {
        await new TerseWorkflowBuilder(cwd, out).build()
    } finally {
        fs.rmSync(dispatcherFile, { force: true })
    }

    // recoverActiveRuns: false so a re-test doesn't replay the previous run's
    // pending/active runs from the data dir.
    const world = createLocalWorld({ dataDir: path.join(cwd, ".terse", "data"), recoverActiveRuns: false })
    await world.start?.()
    setWorld(world)

    const require = createRequire(import.meta.url)
    world.registerHandler("__wkf_step_", require(path.join(out, "steps.cjs")).POST)
    world.registerHandler("__wkf_workflow_", require(path.join(out, "workflows.cjs")).POST)

    // Map each job name to its own workflow's id (one "use workflow" per job).
    const manifest = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8"))
    const workflowIdByJob = new Map(workflowFns.map(({ jobName, fnName }) => [jobName, findWorkflowId(manifest, fnName)]))

    return {
        dispatchJob: (jobName, ctx, event) => {
            const workflowId = workflowIdByJob.get(jobName)
            if (!workflowId) throw new Error(`No durable workflow was built for job "${jobName}".`)
            return start({ workflowId }, [ctx, event])
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
    throw new Error(`Workflow "${fnName}" not found in manifest — was the generated dispatcher discovered by the build?`)
}

// Generate one "use workflow" per registered job into the user's source so the
// builder discovers each as its own workflow (distinct workflowId, per-job runs).
// A workflow body must be pure orchestration — it can't use packages that touch
// Node.js modules (terse-sdk does) — so each shell delegates to a shared "use
// step" (runJob), where all terse-sdk usage is allowed. No entry import is
// needed: loadJobRegistry already populated the process-global, Symbol.for-keyed
// registry that the in-process worker's fetchRegisteredJobs() reads.
function writeDispatcherFile(cwd: string, entryFile?: string): { file: string; workflowFns: Array<{ jobName: string; fnName: string }> } {
    const entry = entryFile ?? resolveEntry(cwd)
    const dir = path.dirname(path.join(cwd, entry))
    const file = path.join(dir, "__terse_workflow.ts")

    const workflowFns = [...fetchRegisteredJobs().keys()].map((jobName, i) => ({ jobName, fnName: `terseJob_${i}` }))

    const shells = workflowFns
        .map(
            ({ jobName, fnName }) => `export async function ${fnName}(ctx, event) {
  "use workflow"
  return await runJob(${JSON.stringify(jobName)}, ctx, event)
}`
        )
        .join("\n\n")

    fs.writeFileSync(
        file,
        `import { createSDKTrigger, fetchRegisteredJobs, runWithJobContext } from "terse-sdk"

async function runJob(jobName, ctx, event) {
  "use step"
  const job = fetchRegisteredJobs().get(jobName)
  if (!job) throw new Error(\`Job "\${jobName}" not registered\`)
  return runWithJobContext(ctx, async () => {
    const trigger = createSDKTrigger(event)
    if (job.filter && !(await job.filter(trigger))) return { status: "ok", filtered: true }
    await job.onTrigger(trigger)
    return { status: "ok" }
  })
}

${shells}
`
    )
    return { file, workflowFns }
}

function resolveEntry(cwd: string): string {
    for (const candidate of ["src/terse.jobs.ts", "src/index.ts"]) {
        if (fs.existsSync(path.join(cwd, candidate))) return candidate
    }
    throw new Error("Could not find a job entry (src/terse.jobs.ts or src/index.ts)")
}
