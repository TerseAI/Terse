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

// A suspension is explicitly parked through /sdk/suspend before the CLI exits. Process
// exit therefore normally only needs to preserve that state or classify the command as
// success/failure. Deploys built before the Little Durable migration are the exception:
// they exit 0 for both failures and input waits, so their legacy journal remains the verdict.
export async function resolveRunStatus(params: ResolveRunStatusParams): Promise<RunOutcome> {
    const { runId, agent, result, runtimeName, sandbox } = params
    const legacyJournal = result.exitCode === 0 ? await readLegacyRunJournalState(runId, agent.project.id, sandbox) : null

    if (legacyJournal) {
        logger.warn("SDK sandbox: deprecated durable runtime detected", { runId, agentId: agent.id, runtime: runtimeName })
        try {
            await params.onLegacyRuntimeDetected?.()
        } catch (error) {
            // A warning must never change the outcome of the user's run.
            logger.warn("SDK sandbox: failed to emit deprecated runtime warning", { runId, agentId: agent.id, error })
        }
    }

    const run = await db().run_history_records.findUnique({ where: { id: runId }, select: { status: true } })

    if (run?.status === "suspended") {
        logger.info("SDK sandbox: run exited suspended", { runId, agentId: agent.id })
        return { status: "suspended" }
    }

    if (result.exitCode !== 0) {
        const errorMsg = result.stderr?.trim().slice(0, 500) || `Process exited with code ${result.exitCode}`
        logger.error("SDK sandbox: terse run failed", { runId, agentId: agent.id, exitCode: result.exitCode, runtime: runtimeName })
        return { status: "failed", cause: new Error(errorMsg) }
    }

    if (legacyJournal?.status === "failed") {
        logger.error("SDK sandbox: legacy durable run failed", { runId, agentId: agent.id })
        return { status: "failed", cause: new Error("Durable run failed; see the run output for details") }
    }

    if (legacyJournal?.status === "running" && legacyJournal.awaitingHook) {
        const imageId = await snapshotSandboxForSuspend(runId, sandbox)
        if (!imageId) {
            logger.error("SDK sandbox: legacy parked run could not be snapshotted", { runId, agentId: agent.id })
            return { status: "failed", cause: new Error("Could not snapshot the parked run journal") }
        }
        await markRunSuspended(runId, imageId, { kind: "input", hookToken: legacyJournal.hookToken })
        logger.info("SDK sandbox: legacy run parked waiting for input", { runId, agentId: agent.id })
        return { status: "suspended" }
    }

    logger.info("SDK sandbox: terse run completed", { runId, agentId: agent.id, runtime: runtimeName })
    return { status: "success" }
}

// Snapshots a suspending run's filesystem off its live sandbox and returns the resulting
// image id, which the resuming run boots from. Returns undefined when there is no live sandbox.
export async function snapshotSandboxForSuspend(runId: string, liveSandbox?: Sandbox): Promise<string | undefined> {
    const provider = getSandboxProvider()
    const sandbox = liveSandbox ?? (await findRunSandbox(runId))
    if (!sandbox) return undefined
    return provider.snapshotForSuspension(sandbox)
}

// For callers outside the run's own worker (e.g. /sdk/suspend), which hold no sandbox handle.
async function findRunSandbox(runId: string): Promise<Sandbox | null> {
    const run = await db().run_history_records.findUnique({ where: { id: runId }, select: { automation: { select: { project_id: true } } } })
    const projectId = run?.automation?.project_id
    if (!projectId) return null

    const provider = getSandboxProvider()
    const app = await provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
    return provider.getExistingSandbox(app, runtimeSandboxUniqueName(projectId, runId))
}

// helpers

type ResolveRunStatusParams = {
    runId: string
    agent: AgentWithRelations
    result: SandboxCommandResult
    runtimeName: string
    /** The sandbox the run just executed in, avoiding a second lookup for legacy journal reads. */
    sandbox?: Sandbox
    onLegacyRuntimeDetected?: () => Promise<void>
}

type LegacyRunJournalState = { status: string; awaitingHook: boolean; hookToken?: string }

// @workflow/world-local stored run state and unresolved hooks in nested directories.
// Little Durable stores event files directly under /terse-runs/<runId>, so this is also
// an authoritative, version-free way to distinguish old deployed images from new ones.
async function readLegacyRunJournalState(runId: string, projectId: string, liveSandbox?: Sandbox): Promise<LegacyRunJournalState | null> {
    if (liveSandbox) return readLegacyJournalOrNull(liveSandbox, runId)

    const provider = getSandboxProvider()
    const app = await provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
    const sandbox = await provider.getExistingSandbox(app, runtimeSandboxUniqueName(projectId, runId))
    if (!sandbox) return null
    return readLegacyJournalOrNull(sandbox, runId)
}

async function readLegacyJournalOrNull(sandbox: Sandbox, runId: string): Promise<LegacyRunJournalState | null> {
    try {
        return await readLegacyJournalFromSandbox(sandbox, runId)
    } catch (error) {
        logger.warn("SDK sandbox: legacy journal read failed", { runId, sandboxId: sandbox.sandboxId, error })
        return null
    }
}

async function readLegacyJournalFromSandbox(sandbox: Sandbox, runId: string): Promise<LegacyRunJournalState | null> {
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
