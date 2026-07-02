/**
 * Worker-side dispatcher for the `sdk-run-execution` queue. Reconstructs the agent + user session
 * from ids (no in-memory request state), gates + base-charges the run, resolves the JobExecutor for
 * the run's kind, and owns every terminal run transition in one place. Billing lives here so it is the
 * single choke point: no run-execution path — sandbox or remote-webhook — can bypass it. On an
 * unexpected throw it finalizes the run and rethrows so pg-boss records the job as failed (retryLimit 0
 * — never silently retried).
 */
import { RunHistoryStatus } from "terse-types"

import logger from "../../common/logger"
import { getInputConfigInclude, getOutputConfigInclude } from "../../common/prismaIncludes"
import { db } from "../../loaders/prisma"
import { emitCacheInvalidationWithWildcard, finalizeRunFailure } from "../../loaders/socket"
import { claimSuspendedRun, finalizeRunStatus, markRunFailed, markRunSkipped } from "../../modules/agents/AgentRunner/runHistory"
import { classifyAgentError } from "../../modules/agents/agentErrorUtils"
import { billingServiceProxyForOrganization, startBillingRun } from "../../services/BillingService"
import { jobExecutorRegistry } from "../../services/jobExecutors/JobExecutorRegistry"
import { AgentWithRelations } from "../../types/prisma"
import { resolveUserInOrg } from "../../utility/identity"
import { RunExecutionJobData } from "../queues/runExecutionQueue"

function loadAgentForExecution(agentId: string, orgId: string): Promise<AgentWithRelations | null> {
    return db().automations.findUnique({
        where: { id: agentId, organization_id: orgId },
        include: {
            prompt: true,
            inputs: { include: getInputConfigInclude() },
            outputs: { include: getOutputConfigInclude() },
            tool_approvals: true,
            project: true
        }
    })
}

export async function handleRunExecution(data: RunExecutionJobData): Promise<void> {
    const { runId, agentId, orgId, userId, jobName, kind, restoreImageId } = data

    // A delayed resume may fire after the run was cancelled while suspended; only the caller
    // that flips suspended -> in_progress may execute, so a failed claim means drop the job.
    if (restoreImageId) {
        const claimed = await claimSuspendedRun(runId)
        if (!claimed) {
            logger.info("Run resumption skipped: run is no longer suspended", { runId, agentId })
            return
        }
    }

    const user = await resolveUserInOrg(userId, orgId)
    if (!user) {
        logger.error("Run execution: user not found; failing run", { runId, userId, orgId })
        await markRunFailed(runId, "User not found for run execution", "agent")
        throw new Error("User not found for run execution")
    }

    const agent = await loadAgentForExecution(agentId, orgId)
    if (!agent) {
        logger.error("Run execution: agent not found; failing run", { runId, agentId, orgId })
        await markRunFailed(runId, "Agent not found for run execution", "agent")
        emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
        throw new Error("Agent not found for run execution")
    }

    try {
        // Single billing choke point: every run is gated + base-charged here, before its executor runs.
        // A denied gate fails the run before any sandbox is created or any webhook is delivered.
        // Resumes skip it: the run was already gated + base-charged at original dispatch.
        if (!restoreImageId) {
            const billing = billingServiceProxyForOrganization(orgId, userId)
            await startBillingRun(billing, { organizationId: orgId, runId })
        }

        const executor = jobExecutorRegistry.resolve(kind)
        const outcome = await executor.execute({ runId, agent, orgId, userId, user, jobName, restoreImageId })
        switch (outcome.status) {
            case "success":
                await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agent.id)
                return
            case "skipped":
                await markRunSkipped(runId, outcome.reason)
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agent.id)
                return
            case "failed":
                await finalizeRunFailure(runId, classifyAgentError(outcome.cause), user, agent)
                return
            default:
                throw outcome satisfies never
        }
    } catch (error) {
        logger.error("Run execution failed", { error, runId, agentId, kind })
        await finalizeRunFailure(runId, classifyAgentError(error), user, agent)
        throw error
    }
}
