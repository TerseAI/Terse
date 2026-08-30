import logger from "../common/logger"
import { db } from "../loaders/prisma"
import { AgentWithRelations } from "../types/prisma"

import { RunOutcome } from "./jobExecutors/types"
import { getSandboxProvider } from "./sandboxProvider"
import { Sandbox } from "./sandboxProvider/SandboxService"
import { SandboxCommandResult } from "./sdkRuntimeExecutors/types"
import { SDK_SANDBOX_APP_NAME, runtimeSandboxUniqueName } from "./sdkSandboxLayerKeys"

// A suspension is explicitly parked through /sdk/suspend before the CLI exits. Process
// exit therefore only needs to preserve that state or classify the command as success/failure.
export async function resolveRunStatus(params: ResolveRunStatusParams): Promise<RunOutcome> {
    const { runId, agent, result, runtimeName } = params
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

    logger.info("SDK sandbox: terse run completed", { runId, agentId: agent.id, runtime: runtimeName })
    return { status: "success" }
}

// Snapshots a suspending run's filesystem off its live sandbox and returns the resulting
// image id, which the resuming run boots from. Returns undefined when there is no live sandbox.
export async function snapshotSandboxForSuspend(runId: string): Promise<string | undefined> {
    const provider = getSandboxProvider()
    const sandbox = await findRunSandbox(runId)
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
}
