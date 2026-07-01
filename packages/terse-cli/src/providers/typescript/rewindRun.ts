import fs from "node:fs"
import path from "node:path"

// Re-driving a terminally failed run is not a native workflow-SDK operation, so we
// do the minimum journal surgery here and let the normal recovery path replay the
// rest. The world is event-sourced: a failed run's log ends with the failing step's
// events plus a `run_failed` event, and replay re-applies both. Removing those (and
// resetting the run record to "running") makes recovery re-enqueue the run, replay
// the cached `step_completed` results, and re-execute from the failed point under the
// current code. ALL beta-format knowledge (file layout, event shapes) is contained in
// this file, scoped strictly to the local dev world, so a beta bump breaks only here.

export type RewindResult = { workflowRunId: string; rewoundStepId: string | null; deletedEvents: number }

const STEP_EVENT_TYPES = new Set(["step_created", "step_started", "step_completed", "step_failed", "step_retrying"])

export function resolveWorkflowRunId(dataDir: string, id: string): string {
    if (id.startsWith("wrun_")) return id
    const runsDir = path.join(dataDir, "runs")
    if (fs.existsSync(runsDir)) {
        for (const file of fs.readdirSync(runsDir)) {
            if (!file.endsWith(".json")) continue
            const run = readJson(path.join(runsDir, file))
            if (run?.attributes?.runId === id) return run.runId
        }
    }
    throw new Error(`No durable run is mapped to Terse run id "${id}". Pass a workflow run id (wrun_...) directly if you have it.`)
}

export function readRunStatus(dataDir: string, workflowRunId: string): string | null {
    return readJson(path.join(dataDir, "runs", `${workflowRunId}.json`))?.status ?? null
}

export function rewindFailedRun(dataDir: string, workflowRunId: string): RewindResult {
    const runFile = path.join(dataDir, "runs", `${workflowRunId}.json`)
    const run = readJson(runFile)
    if (!run) throw new Error(`Run "${workflowRunId}" not found in ${dataDir}.`)
    if (run.status !== "failed") throw new Error(`Run "${workflowRunId}" is "${run.status}", not "failed" — nothing to rewind.`)

    const events = listRunEvents(dataDir, workflowRunId)

    // Only operate on journal shapes we can reason about; otherwise the caller
    // should re-run the job fresh instead.
    if (hasUnclosed(events, "wait_created", "wait_completed")) throw new Error(`Run "${workflowRunId}" has an open wait; re-drive is not supported. Re-run it fresh instead.`)
    if (hasUnclosed(events, "hook_created", "hook_disposed")) throw new Error(`Run "${workflowRunId}" has an open hook; re-drive is not supported. Re-run it fresh instead.`)

    const completed = new Set(events.filter(e => e.eventType === "step_completed").map(e => e.correlationId))
    const touched = new Set(events.filter(e => STEP_EVENT_TYPES.has(e.eventType) && e.correlationId).map(e => e.correlationId))
    const incomplete = [...touched].filter(id => !completed.has(id))
    if (incomplete.length > 1) throw new Error(`Run "${workflowRunId}" has ${incomplete.length} incomplete steps; re-drive only supports a single failed step. Re-run it fresh instead.`)
    const rewoundStepId = incomplete[0] ?? null

    backupRun(dataDir, workflowRunId, runFile, events)

    let deletedEvents = 0
    for (const e of events) {
        const isFailureMarker = e.eventType === "run_failed"
        const isRewoundStepEvent = rewoundStepId !== null && e.correlationId === rewoundStepId && STEP_EVENT_TYPES.has(e.eventType)
        if (isFailureMarker || isRewoundStepEvent) {
            fs.rmSync(path.join(dataDir, "events", e.file), { force: true })
            deletedEvents++
        }
    }

    // Drop any non-completed step entity (covers the failed step regardless of how its
    // composite key is derived) so replay re-executes it rather than seeing it terminal.
    for (const file of listRunStepFiles(dataDir, workflowRunId)) {
        const step = readJson(path.join(dataDir, "steps", file))
        if (step && step.status !== "completed") fs.rmSync(path.join(dataDir, "steps", file), { force: true })
    }

    delete run.error
    delete run.completedAt
    delete run.output
    run.status = "running"
    run.updatedAt = new Date().toISOString()
    fs.writeFileSync(runFile, JSON.stringify(run, null, 2))

    return { workflowRunId, rewoundStepId, deletedEvents }
}

type RunEvent = { file: string; eventType: string; correlationId?: string }

function listRunEvents(dataDir: string, workflowRunId: string): RunEvent[] {
    const eventsDir = path.join(dataDir, "events")
    if (!fs.existsSync(eventsDir)) return []
    const prefix = `${workflowRunId}-`
    const out: RunEvent[] = []
    for (const file of fs.readdirSync(eventsDir)) {
        if (!file.startsWith(prefix) || !file.endsWith(".json")) continue
        const event = readJson(path.join(eventsDir, file))
        if (event?.eventType) out.push({ file, eventType: event.eventType, correlationId: event.correlationId })
    }
    return out
}

function listRunStepFiles(dataDir: string, workflowRunId: string): string[] {
    const stepsDir = path.join(dataDir, "steps")
    if (!fs.existsSync(stepsDir)) return []
    return fs.readdirSync(stepsDir).filter(file => file.startsWith(`${workflowRunId}-`) && file.endsWith(".json"))
}

function hasUnclosed(events: RunEvent[], openType: string, closeType: string): boolean {
    const closed = new Set(events.filter(e => e.eventType === closeType).map(e => e.correlationId))
    return events.some(e => e.eventType === openType && !closed.has(e.correlationId))
}

function backupRun(dataDir: string, workflowRunId: string, runFile: string, events: RunEvent[]): void {
    const dir = path.join(dataDir, ".rewind-backup", `${workflowRunId}-${Date.now()}`)
    fs.mkdirSync(path.join(dir, "events"), { recursive: true })
    fs.mkdirSync(path.join(dir, "steps"), { recursive: true })
    fs.mkdirSync(path.join(dir, "runs"), { recursive: true })
    fs.copyFileSync(runFile, path.join(dir, "runs", `${workflowRunId}.json`))
    for (const e of events) fs.copyFileSync(path.join(dataDir, "events", e.file), path.join(dir, "events", e.file))
    for (const file of listRunStepFiles(dataDir, workflowRunId)) fs.copyFileSync(path.join(dataDir, "steps", file), path.join(dir, "steps", file))
}

function readJson(file: string): any {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"))
    } catch {
        return null
    }
}
