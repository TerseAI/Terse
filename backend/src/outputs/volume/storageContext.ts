import type { Session } from "../../express"
import { findAutomationInOrg } from "../../modules/improvements/repository"
import { SDK_AGENT_ID, type SessionWithTracking } from "../../modules/agents/AgentRunner/BaseAgentRunner"

export type AgentStorageContext = {
    agentId: string
    organizationId: string
}

export async function resolveAgentStorageContext(context: SessionWithTracking<Session> | undefined): Promise<AgentStorageContext> {
    const resolved = resolveContextClaim(context)

    const automation = await findAutomationInOrg(resolved.agentId, resolved.organizationId)
    if (!automation) {
        throw new Error("Agent storage context is unavailable: agent does not belong to this organization.")
    }

    return resolved
}

function resolveContextClaim(context: SessionWithTracking<Session> | undefined): AgentStorageContext {
    if (!context) {
        throw new Error("No run context provided")
    }

    if (context.storage?.agentId && context.storage.organizationId) {
        return context.storage
    }

    if (context.agentId && context.agentId !== SDK_AGENT_ID && context.user.organizationId) {
        return {
            agentId: context.agentId,
            organizationId: context.user.organizationId
        }
    }

    throw new Error("Agent storage context is unavailable. Run this tool during a production agent run with x-terse-run-id.")
}
