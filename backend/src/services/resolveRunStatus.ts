import logger from "../common/logger"
import { SandboxRuntimeTelemetry } from "../common/sandboxRuntimeTelemetry"
import { shellQuote } from "../common/shellEscape"
import { db } from "../loaders/prisma"
import { markRunSuspended } from "../modules/agents/AgentRunner/runHistory"
import { AgentWithRelations } from "../types/prisma"

import { RunOutcome } from "./jobExecutors/types"
import { getSandboxProvider } from "./sandboxProvider"
import { Sandbox } from "./sandboxProvider/SandboxService"
import { runJournalDir } from "./sandboxProvider/runJournal"
import { SandboxCommandResult } from "./sdkRuntimeExecutors/types"
import { SDK_SANDBOX_APP_NAME, runtimeSandboxUniqueName } from "./sdkSandboxLayerKeys"

// Sandboxes fire-and-forget: completed, parked, and workflow-failed runs all exit 0, and
// the (final, since the process is dead) journal is the source of truth for which. Parked
// runs are marked suspended here; final statuses are left to the run execution handler.
export async function resolveRunStatus(params: ResolveRunStatusParams): Promise<RunOutcome> {
    const { runId, agent, result, runtimeName, telemetry } = params
    const journal =
        result.exitCode === 0 ? await (telemetry ? telemetry.measure("readRunJournalMs", () => readRunJournalState(runId, agent.project.id)) : readRunJournalState(runId, agent.project.id)) : null
    const verdict = classifyRunExit(result, journal)

    switch (verdict) {
        case "failed_exit": {
            const errorMsg = result.stderr?.trim().slice(0, 500) || `Process exited with code ${result.exitCode}`
            logger.error("SDK sandbox: terse run failed", { runId, agentId: agent.id, exitCode: result.exitCode, runtime: runtimeName })
            return { status: "failed", cause: new Error(errorMsg) }
        }
        case "failed_in_workflow": {
            logger.error("SDK sandbox: durable run failed", { runId, agentId: agent.id })
            return { status: "failed", cause: new Error("Durable run failed; see the run output for details") }
        }
        case "parked_on_input": {
            const imageId = await snapshotSandboxForSuspend(runId, telemetry)
            if (!imageId) {
                logger.error("SDK sandbox: parked run could not be snapshotted", { runId, agentId: agent.id })
                return { status: "failed", cause: new Error("Could not snapshot the parked run journal") }
            }
            await markRunSuspended(runId, imageId, { kind: "input", hookToken: journal?.hookToken })
            logger.info("SDK sandbox: run parked waiting for input", { runId, agentId: agent.id })
            return { status: "suspended" }
        }
        case "suspended_on_timer": {
            // /sdk/suspend already parked it; nothing to finalize.
            logger.info("SDK sandbox: run exited suspended on a timer", { runId, agentId: agent.id })
            return { status: "suspended" }
        }
        case "completed": {
            logger.info("SDK sandbox: terse run completed", { runId, agentId: agent.id, runtime: runtimeName })
            return { status: "success" }
        }
        default:
            throw verdict satisfies never
    }
}

// Snapshots a suspending run's filesystem off its live sandbox and returns the resulting
// image id, which the resuming run boots from. Returns undefined when there is no live sandbox.
export async function snapshotSandboxForSuspend(runId: string, telemetry?: SandboxRuntimeTelemetry): Promise<string | undefined> {
    const run = await db().run_history_records.findUnique({ where: { id: runId }, select: { automation: { select: { project_id: true } } } })
    const projectId = run?.automation?.project_id
    if (!projectId) return undefined

    const provider = getSandboxProvider()
    const app = await provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
    const sandbox = await provider.getExistingSandbox(app, runtimeSandboxUniqueName(projectId, runId))
    if (!sandbox) return undefined

    if (telemetry) {
        return telemetry.measure("snapshotSandboxMs", () => provider.snapshotForSuspension(sandbox))
    }
    return provider.snapshotForSuspension(sandbox)
}

// helpers

type ResolveRunStatusParams = {
    runId: string
    agent: AgentWithRelations
    result: SandboxCommandResult
    runtimeName: string
    telemetry?: SandboxRuntimeTelemetry
}

export type RunVerdict = "failed_exit" | "failed_in_workflow" | "parked_on_input" | "suspended_on_timer" | "completed"

function classifyRunExit(result: SandboxCommandResult, journal: RunJournalState | null): RunVerdict {
    if (result.exitCode !== 0) return "failed_exit"
    if (journal?.status === "failed") return "failed_in_workflow"
    if (journal?.status === "running" && journal.awaitingHook) return "parked_on_input"
    if (journal?.status === "running") return "suspended_on_timer"
    return "completed"
}

type RunJournalState = { status: string; awaitingHook: boolean; hookToken?: string }

// Reads world-local's journal off the sandbox filesystem: the run record's status field
// (runs/*.json) and whether any unresolved hook entity remains (hooks/*.json; answered
// hooks are deleted on dispose).
async function readRunJournalState(runId: string, projectId: string): Promise<RunJournalState | null> {
    const provider = getSandboxProvider()
    const app = await provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
    const sandbox = await provider.getExistingSandbox(app, runtimeSandboxUniqueName(projectId, runId))
    if (!sandbox) return null
    return readJournalFromSandbox(sandbox, runId)
}

async function readJournalFromSandbox(sandbox: Sandbox, runId: string): Promise<RunJournalState | null> {
    const journalDir = runJournalDir(runId)
    const command = `grep -ho '"status": *"[a-z_]*"' ${shellQuote(journalDir)}/runs/*.json 2>/dev/null | head -1; echo ---; grep -ho '"token": *"[^"]*"' ${shellQuote(journalDir)}/hooks/*.json 2>/dev/null | head -1`
    const proc = await sandbox.exec(["sh", "-c", command], { stdout: "pipe", stderr: "pipe" })
    const stdout = await proc.stdout.readText()
    await proc.wait()

    const [statusRaw = "", hookRaw = ""] = stdout.split("---")
    const status = statusRaw.match(/"status": *"([a-z_]+)"/)?.[1]
    if (!status) return null
    const hookToken = hookRaw.match(/"token": *"([^"]+)"/)?.[1]
    return { status, awaitingHook: hookToken !== undefined, hookToken }
}
