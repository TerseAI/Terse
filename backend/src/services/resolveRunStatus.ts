import logger from "../common/logger"
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
    const { runId, agent, result, runtimeName } = params
    const journal = result.exitCode === 0 ? await readRunJournalState(runId, agent.project.id) : null
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
            const imageId = await snapshotRunJournalForSuspend(runId)
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

// Snapshots a suspending run's journal directory off its live sandbox and returns the
// resulting image id. Returns undefined when the run has no live sandbox.
export async function snapshotRunJournalForSuspend(runId: string): Promise<string | undefined> {
    const run = await db().run_history_records.findUnique({ where: { id: runId }, select: { automation: { select: { project_id: true } } } })
    const projectId = run?.automation?.project_id
    if (!projectId) return undefined

    const provider = getSandboxProvider()
    const app = await provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
    const sandbox = await provider.getExistingSandbox(app, runtimeSandboxUniqueName(projectId, runId))
    if (!sandbox) return undefined

    return provider.snapshotDirectory(sandbox, runJournalDir(runId))
}

// helpers

type ResolveRunStatusParams = {
    runId: string
    agent: AgentWithRelations
    result: SandboxCommandResult
    runtimeName: string
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
