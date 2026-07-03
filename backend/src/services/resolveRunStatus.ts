import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { UserSession } from "terse-types/types"

import logger from "../common/logger"
import { shellQuote } from "../common/shellEscape"
import { db } from "../loaders/prisma"
import { emitCacheInvalidationWithWildcard, finalizeRunFailure } from "../loaders/socket"
import { finalizeRunStatus, markRunSuspended } from "../modules/agents/AgentRunner/runHistory"
import { classifyAgentError } from "../modules/agents/agentErrorUtils"
import { AgentWithRelations } from "../types/prisma"

import { getSandboxProvider } from "./sandboxProvider"
import { Sandbox } from "./sandboxProvider/SandboxService"
import { runJournalDir } from "./sandboxProvider/runJournal"
import { SandboxCommandResult } from "./sdkRuntimeExecutors/types"
import { SDK_SANDBOX_APP_NAME, runtimeSandboxUniqueName } from "./sdkSandboxLayerKeys"

export type RunVerdict = "failed_exit" | "failed_in_workflow" | "parked_on_input" | "suspended_on_timer" | "completed"

type ResolveRunStatusParams = {
    runId: string
    agent: AgentWithRelations
    orgId: string
    user: UserSession
    result: SandboxCommandResult
    runtimeName: string
}

// Sandboxes fire-and-forget: completed, parked, and workflow-failed runs all exit 0, and
// the (final, since the process is dead) journal is the source of truth for which.
export async function resolveRunStatus(params: ResolveRunStatusParams): Promise<void> {
    const { runId, agent, orgId, user, result, runtimeName } = params
    const journal = result.exitCode === 0 ? await readRunJournalState(runId, agent.project.id) : null
    const verdict = classifyRunExit(result, journal)

    switch (verdict) {
        case "failed_exit": {
            const errorMsg = result.stderr?.trim().slice(0, 500) || `Process exited with code ${result.exitCode}`
            await finalizeRunFailure(runId, classifyAgentError(new Error(errorMsg)), user, agent)
            logger.error("SDK sandbox: terse run failed", { runId, agentId: agent.id, exitCode: result.exitCode, runtime: runtimeName })
            return
        }
        case "failed_in_workflow": {
            await finalizeRunFailure(runId, classifyAgentError(new Error("Durable run failed; see the run output for details")), user, agent)
            logger.error("SDK sandbox: durable run failed", { runId, agentId: agent.id })
            return
        }
        case "parked_on_input": {
            const imageId = await snapshotRunJournalForSuspend(runId)
            if (!imageId) {
                await finalizeRunFailure(runId, classifyAgentError(new Error("Could not snapshot the parked run journal")), user, agent)
                logger.error("SDK sandbox: parked run could not be snapshotted", { runId, agentId: agent.id })
                return
            }
            await markRunSuspended(runId, imageId, { kind: "input", hookToken: journal?.hookToken })
            emitCacheInvalidationWithWildcard(orgId, "runHistory", agent.id)
            logger.info("SDK sandbox: run parked waiting for input", { runId, agentId: agent.id })
            return
        }
        case "suspended_on_timer": {
            // /sdk/suspend already parked it; nothing to finalize.
            logger.info("SDK sandbox: run exited suspended on a timer", { runId, agentId: agent.id })
            return
        }
        case "completed": {
            await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
            emitCacheInvalidationWithWildcard(orgId, "runHistory", agent.id)
            logger.info("SDK sandbox: terse run completed", { runId, agentId: agent.id, runtime: runtimeName })
            return
        }
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
