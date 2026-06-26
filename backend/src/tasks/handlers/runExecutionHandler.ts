/**
 * Worker-side processor for the `sdk-run-execution` queue. Reconstructs the agent + user session
 * from ids (no in-memory request state) and runs the same SdkJobExecutionService.execute() the web
 * process used to fire-and-forget. On failure it finalizes the run and rethrows so BullMQ records
 * the job as failed (attempts: 1 — never silently retried).
 */
import logger from "../../common/logger"
import { getInputConfigInclude, getOutputConfigInclude } from "../../common/prismaIncludes"
import { db } from "../../loaders/prisma"
import { finalizeRunFailure } from "../../loaders/socket"
import { markRunFailed } from "../../modules/agents/AgentRunner/runHistory"
import { classifyAgentError } from "../../modules/agents/agentErrorUtils"
import { SdkJobExecutionService } from "../../services/SdkJobExecutionService"
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
    const { runId, agentId, orgId, userId, jobName } = data

    const user = await resolveUserInOrg(userId, orgId)
    if (!user) {
        logger.error("Run execution: user not found; failing run", { runId, userId, orgId })
        await markRunFailed(runId, "User not found for run execution", "agent")
        throw new Error("User not found for run execution")
    }

    const agent = await loadAgentForExecution(agentId, orgId)
    if (!agent) {
        logger.error("Run execution: agent not found; failing run", { runId, agentId, orgId })
        await finalizeRunFailure(runId, classifyAgentError(new Error("Agent not found for run execution")), user, { id: agentId } as AgentWithRelations)
        throw new Error("Agent not found for run execution")
    }

    try {
        await new SdkJobExecutionService().execute({ runId, agent, orgId, userId, user, jobName })
    } catch (error) {
        logger.error("SDK run execution failed", { error, runId, agentId })
        await finalizeRunFailure(runId, classifyAgentError(error), user, agent)
        throw error
    }
}
