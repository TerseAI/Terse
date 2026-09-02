import { Request, Response } from "express"
import { RunHistoryStatus } from "terse-types"
import { DEFAULT_EXECUTION_REGION } from "terse-types/ExecutionRegions"
import { SdkTestRunStartResponse, sdkTestRunFinalizeRequestSchema, sdkTestRunStartRequestSchema } from "terse-types/types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { db } from "../../../loaders/prisma"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../../../loaders/socket"
import { EventProcessor } from "../../../modules/agents/AgentRunner/EventProcessor"
import { finalizeRunStatus, markRunFailed } from "../../../modules/agents/AgentRunner/runHistory"
import { SyntheticTriggerRuntime } from "../../../modules/triggers/syntheticTriggerRuntime"
import { DurableObjectProjectService } from "../../../services/DurableObjectProjectService"
import { getOrCreateOrganizationExecutionRegion } from "../../../services/OrganizationSettingsService"
import { deleteSubtrees } from "../../../services/memory/memorySnapshots"
import { replayMemorySubtreeKey, replayStateSubtreeKey } from "../../../services/sdkSandboxLayerKeys"
import { settings } from "../../../settings"
import { resetJobTestState } from "../state/service"
import { ensureTestAutomation, userOwnsProject } from "../testRunContext"

export async function handleSdkTestRunStart(req: Request, res: Response) {
    const user = req.session?.user
    if (!user?.organizationId) return res.status(401).json({ success: false, error: "Unauthorized" })

    const parsed = sdkTestRunStartRequestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "projectId, jobName and event are required" })

    const projectId = await userOwnsProject(parsed.data.projectId, user)
    if (!projectId) return res.status(404).json({ success: false, error: "Project not found" })

    try {
        const project = await db().projects.findUnique({ where: { id: projectId }, select: { remote_server_url: true } })
        const localDataPlane = parsed.data.forceLocal === true || !project?.remote_server_url
        if (parsed.data.freshState && !localDataPlane) {
            return res.status(400).json({ success: false, error: "--fresh-state is not supported for projects with a remote data plane yet." })
        }

        const executionRegion = settings.workos ? await getOrCreateOrganizationExecutionRegion(user.organizationId) : DEFAULT_EXECUTION_REGION
        const durableObjects = localDataPlane
            ? settings.durableObjects
                ? ((await DurableObjectProjectService.getInstance(settings.durableObjects).issueLocalTestEnvironment(projectId, executionRegion)) ?? null)
                : null
            : undefined
        const agentId = await ensureTestAutomation(user, projectId, parsed.data.jobName)
        if (parsed.data.freshState) await resetJobTestState(projectId, agentId)
        const synthetic = new SyntheticTriggerRuntime(parsed.data.event.data)
        const processor = new EventProcessor(synthetic, user, { isManuallyTriggered: true, isTest: parsed.data.isTest ?? true, localDataPlane, replayOfRunId: parsed.data.replayOfRunId })
        const { runId } = await processor.triggerSingleAgent(agentId)

        const response: SdkTestRunStartResponse = { runId, local: localDataPlane, durableObjects }
        return res.json(response)
    } catch (error) {
        logger.error("[sdk/test-run] Failed to start test run", { jobName: parsed.data.jobName, projectId, error: extractErrorMessage(error) })
        return res.status(500).json({ success: false, error: "Failed to start test run" })
    }
}

export async function handleSdkTestRunFinalize(req: Request, res: Response) {
    const user = req.session?.user
    if (!user?.organizationId) return res.status(401).json({ success: false, error: "Unauthorized" })

    const runId = req.params.runId?.trim()
    if (!runId) return res.status(400).json({ success: false, error: "runId is required" })

    const parsed = sdkTestRunFinalizeRequestSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ success: false, error: "status must be 'success' or 'failed'" })

    const run = await db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: user.organizationId } },
        select: { id: true, automation_id: true, replay_of_run_id: true, automation: { select: { project_id: true } } }
    })
    if (!run) return res.status(404).json({ success: false, error: "Test run not found" })

    try {
        if (parsed.data.status === "success") {
            await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
        } else {
            await markRunFailed(runId, parsed.data.error ?? "Test run failed", "agent")
        }
        if (settings.modal && run.replay_of_run_id) {
            await deleteSubtrees(run.automation.project_id, [replayMemorySubtreeKey(runId), replayStateSubtreeKey(runId)]).catch(error =>
                logger.warn("[sdk/test-run] Failed to GC replay memory subtrees", { runId, error: extractErrorMessage(error) })
            )
        }
        emitCacheInvalidationWithWildcard(user.organizationId, "runHistory", run.automation_id)
        emitCacheInvalidationWithKey(user.organizationId, "recentAgents")
        return res.json({ success: true })
    } catch (error) {
        logger.error("[sdk/test-run] Failed to finalize test run", { runId, error: extractErrorMessage(error) })
        return res.status(500).json({ success: false, error: "Failed to finalize test run" })
    }
}
