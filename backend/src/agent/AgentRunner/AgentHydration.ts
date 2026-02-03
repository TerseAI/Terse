import { KnowledgeBase } from "../../knowledgeBase/abstract/KnowledgeBase"
import { KnowledgeBaseFactory } from "../../knowledgeBase/abstract/KnowledgeBaseFactory"
import logger from "../../logger"
import { Output } from "../../outputs/abstract/Output"
import { OutputFactory } from "../../outputs/abstract/OutputFactory"
import { db } from "../../prismaClient"
import { ConfigInstance } from "../../shared/Configs"
import { User } from "../../shared/types"
import { AgentWithRelations } from "../../types/prisma"
import { Session } from "../../types/session"
import { getAgentHydrationInclude } from "../../utility/prismaIncludes"
import { getUserForOrg } from "../../utility/workos"

import { AgentRunner } from "./AgentRunner"
import { RunContext } from "./SystemPromptBuilder"

export type HydrationError =
    | { type: "agent_not_found"; agentId: string }
    | { type: "user_not_found"; userId: string }
    | { type: "no_outputs"; agentId: string }
    | { type: "output_creation_failed"; agentId: string; error: string }

export type HydrationResult = { success: true; data: HydratedAgent } | { success: false; error: HydrationError }

export interface HydratedAgent {
    agent: AgentWithRelations
    user: User
    session: Session
    outputs: Output<ConfigInstance>[]
    knowledgeBases: KnowledgeBase<ConfigInstance>[]
}

/**
 * Fetches and hydrates an agent by ID with all required relations.
 * Returns the agent along with validated outputs and knowledge bases.
 * Authorization is scoped by organizationId (not userId) so any user in the org can access.
 */
export async function hydrateAgentById(agentId: string, userId: string, organizationId: string): Promise<HydrationResult> {
    const prisma = db()

    const agent = await prisma.automations.findUnique({
        where: {
            id: agentId,
            organization_id: organizationId
        },
        include: getAgentHydrationInclude()
    })

    if (!agent) {
        return {
            success: false,
            error: { type: "agent_not_found", agentId }
        }
    }

    return hydrateAgentFromRecord(agent, userId)
}

/**
 * Hydrates an already-fetched agent record with outputs, knowledge bases, and session.
 * Use this when you already have the agent data (e.g., from a batch query).
 */
export async function hydrateAgentFromRecord(agent: AgentWithRelations, userId: string): Promise<HydrationResult> {
    const prisma = db()

    // Validate outputs exist
    if (!agent.outputs || agent.outputs.length === 0) {
        return {
            success: false,
            error: { type: "no_outputs", agentId: agent.id }
        }
    }

    // Create outputs from agent configuration
    let outputs: Output<ConfigInstance>[]
    try {
        outputs = OutputFactory.createOutputsFromAgent(agent)
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        return {
            success: false,
            error: { type: "output_creation_failed", agentId: agent.id, error: errorMessage }
        }
    }

    // Fetch full user (runtime User type for session)
    const organizationId = agent.organization_id
    if (!organizationId) {
        return {
            success: false,
            error: { type: "user_not_found", userId }
        }
    }
    const user: User | null = await getUserForOrg(userId, organizationId)
    if (!user) {
        return {
            success: false,
            error: { type: "user_not_found", userId }
        }
    }

    // Create session
    const session: Session = {
        user,
        isUserInitiated: true
    }

    // Create knowledge bases
    const knowledgeBases = KnowledgeBaseFactory.createKnowledgeBasesFromAgent(agent.knowledge_bases || [])

    return {
        success: true,
        data: {
            agent,
            user,
            session,
            outputs,
            knowledgeBases
        }
    }
}

/**
 * Creates a fully configured AgentRunner from hydrated agent data.
 */
export function createAgentRunner(hydrated: HydratedAgent, runContext: RunContext): AgentRunner<Session, ConfigInstance, ConfigInstance> {
    return new AgentRunner(hydrated.session, hydrated.outputs, hydrated.knowledgeBases, hydrated.agent, runContext)
}

/**
 * Convenience function to hydrate an agent and create an AgentRunner in one step.
 */
export async function hydrateAndCreateRunner(
    agentId: string,
    userId: string,
    organizationId: string,
    runContext: RunContext
): Promise<{ success: true; runner: AgentRunner<Session, ConfigInstance, ConfigInstance>; hydrated: HydratedAgent } | { success: false; error: HydrationError }> {
    const result = await hydrateAgentById(agentId, userId, organizationId)

    if (!result.success) {
        return result
    }

    const runner = createAgentRunner(result.data, runContext)

    return {
        success: true,
        runner,
        hydrated: result.data
    }
}

/**
 * Formats a hydration error for logging.
 */
export function formatHydrationError(error: HydrationError): string {
    switch (error.type) {
        case "agent_not_found":
            return `Agent not found: ${error.agentId}`
        case "user_not_found":
            return `User not found: ${error.userId}`
        case "no_outputs":
            return `No output integrations found for agent: ${error.agentId}`
        case "output_creation_failed":
            return `Failed to create outputs for agent ${error.agentId}: ${error.error}`
    }
}
