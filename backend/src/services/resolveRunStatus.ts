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

// New durable workflows explicitly park through /sdk/suspend and keep their journal in a
// durable object. Two older filesystem runtimes remain supported until their deployments
// are replaced: Little Durable's flat event journal and @workflow/world-local's nested state.
export async function resolveRunStatus(params: ResolveRunStatusParams): Promise<RunOutcome> {
    const { runId, agent, result, runtimeName, sandbox, durableJournalBackend } = params
    const deprecatedJournal = durableJournalBackend === "durable_object" ? null : await readDeprecatedJournalState(runId, agent.project.id, sandbox)

    if (deprecatedJournal) {
        logger.warn("SDK sandbox: deprecated filesystem-backed durable runtime detected", {
            runId,
            agentId: agent.id,
            runtime: runtimeName,
            journalKind: deprecatedJournal.kind
        })
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

    const worldLocal = deprecatedJournal?.kind === "world-local" ? deprecatedJournal.state : null
    if (worldLocal?.status === "failed") {
        logger.error("SDK sandbox: legacy durable run failed", { runId, agentId: agent.id })
        return { status: "failed", cause: new Error("Durable run failed; see the run output for details") }
    }

    if (worldLocal?.status === "running" && worldLocal.awaitingHook) {
        const imageId = await snapshotSandboxForSuspend(runId, sandbox)
        if (!imageId) {
            logger.error("SDK sandbox: legacy parked run could not be snapshotted", { runId, agentId: agent.id })
            return { status: "failed", cause: new Error("Could not snapshot the parked run journal") }
        }
        await markRunSuspended(runId, imageId, { kind: "input", hookToken: worldLocal.hookToken })
        logger.info("SDK sandbox: legacy run parked waiting for input", { runId, agentId: agent.id })
        return { status: "suspended" }
    }

    logger.info("SDK sandbox: terse run completed", { runId, agentId: agent.id, runtime: runtimeName })
    return { status: "success" }
}

// Snapshots a run's filesystem and returns the image used by its next sandbox.
export async function snapshotSandboxForSuspend(runId: string, liveSandbox?: Sandbox): Promise<string | undefined> {
    const provider = getSandboxProvider()
    const sandbox = liveSandbox ?? (await findRunSandbox(runId))
    if (!sandbox) return undefined
    return provider.snapshotForSuspension(sandbox)
}

async function findRunSandbox(runId: string): Promise<Sandbox | null> {
    const run = await db().run_history_records.findUnique({ where: { id: runId }, select: { automation: { select: { project_id: true } } } })
    const projectId = run?.automation?.project_id
    if (!projectId) return null

    const provider = getSandboxProvider()
    const app = await provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
    return provider.getExistingSandbox(app, runtimeSandboxUniqueName(projectId, runId))
}

type ResolveRunStatusParams = {
    runId: string
    agent: AgentWithRelations
    result: SandboxCommandResult
    runtimeName: string
    durableJournalBackend: string | null
    sandbox?: Sandbox
    onLegacyRuntimeDetected?: () => Promise<void>
}

type WorldLocalJournalState = { status: string; awaitingHook: boolean; hookToken?: string }
type DeprecatedJournalState = { kind: "little-durable-file" } | { kind: "world-local"; state: WorldLocalJournalState }

async function readDeprecatedJournalState(runId: string, projectId: string, liveSandbox?: Sandbox): Promise<DeprecatedJournalState | null> {
    if (liveSandbox) return readDeprecatedJournalOrNull(liveSandbox, runId)

    const provider = getSandboxProvider()
    const app = await provider.getOrCreateApp(SDK_SANDBOX_APP_NAME)
    const sandbox = await provider.getExistingSandbox(app, runtimeSandboxUniqueName(projectId, runId))
    if (!sandbox) return null
    return readDeprecatedJournalOrNull(sandbox, runId)
}

async function readDeprecatedJournalOrNull(sandbox: Sandbox, runId: string): Promise<DeprecatedJournalState | null> {
    try {
        return await readDeprecatedJournalFromSandbox(sandbox, runId)
    } catch (error) {
        logger.warn("SDK sandbox: deprecated journal read failed", { runId, sandboxId: sandbox.sandboxId, error })
        return null
    }
}

async function readDeprecatedJournalFromSandbox(sandbox: Sandbox, runId: string): Promise<DeprecatedJournalState | null> {
    const journalDir = runJournalDir(runId)
    const quotedDir = shellQuote(journalDir)
    const command = `find ${quotedDir} -maxdepth 1 -type f -name '*.json' -print -quit 2>/dev/null; echo ---; grep -ho '"status": *"[a-z_]*"' ${quotedDir}/runs/*.json 2>/dev/null | head -1; echo ---; grep -ho '"token": *"[^"]*"' ${quotedDir}/hooks/*.json 2>/dev/null | head -1`
    const proc = await sandbox.exec(["sh", "-c", command], { stdout: "pipe", stderr: "pipe" })
    const stdout = await proc.stdout.readText()
    await proc.wait()

    const [flatFile = "", statusRaw = "", hookRaw = ""] = stdout.split("---")
    const status = statusRaw.match(/"status": *"([a-z_]+)"/)?.[1]
    if (status) {
        const hookToken = hookRaw.match(/"token": *"([^"]+)"/)?.[1]
        return { kind: "world-local", state: { status, awaitingHook: hookToken !== undefined, hookToken } }
    }
    return flatFile.trim() ? { kind: "little-durable-file" } : null
}
