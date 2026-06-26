import { Request, Response } from "express"
import { RunHistoryStatus } from "terse-types"
import { SdkTestRunStartResponse, sdkTestRunFinalizeRequestSchema, sdkTestRunStartRequestSchema } from "terse-types/types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { db } from "../../../loaders/prisma"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../../../loaders/socket"
import { EventProcessor } from "../../../modules/agents/AgentRunner/EventProcessor"
import { finalizeRunStatus, markRunFailed } from "../../../modules/agents/AgentRunner/runHistory"
import { SyntheticTriggerRuntime } from "../../../modules/triggers/syntheticTriggerRuntime"
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

        const agentId = await ensureTestAutomation(user, projectId, parsed.data.jobName)
        const synthetic = new SyntheticTriggerRuntime(parsed.data.event.data)
        const processor = new EventProcessor(synthetic, user, { isManuallyTriggered: true, isTest: parsed.data.isTest ?? true, localDataPlane })
        const { runId } = await processor.triggerSingleAgent(agentId)

        const response: SdkTestRunStartResponse = { runId, local: localDataPlane }
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
        select: { id: true, automation_id: true }
    })
    if (!run) return res.status(404).json({ success: false, error: "Test run not found" })

    try {
        if (parsed.data.status === "success") {
            await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
        } else {
            await markRunFailed(runId, parsed.data.error ?? "Test run failed", "agent")
        }
        emitCacheInvalidationWithWildcard(user.organizationId, "runHistory", run.automation_id)
        emitCacheInvalidationWithKey(user.organizationId, "recentAgents")
        return res.json({ success: true })
    } catch (error) {
        logger.error("[sdk/test-run] Failed to finalize test run", { runId, error: extractErrorMessage(error) })
        return res.status(500).json({ success: false, error: "Failed to finalize test run" })
    }
}
