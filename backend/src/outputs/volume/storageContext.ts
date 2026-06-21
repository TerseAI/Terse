import type { Session } from "../../express"
import type { SessionWithTracking } from "../../modules/agents/AgentRunner/BaseAgentRunner"

const SDK_AGENT_RUN_ID = "sdk-agent-run"

export type AgentStorageContext = {
    agentId: string
    organizationId: string
}

export function resolveAgentStorageContext(context: SessionWithTracking<Session> | undefined): AgentStorageContext {
    if (!context) {
        throw new Error("No run context provided")
    }

    if (context.storage?.agentId && context.storage.organizationId) {
        return context.storage
    }

    if (context.agentId && context.agentId !== SDK_AGENT_RUN_ID && context.user.organizationId) {
        return {
            agentId: context.agentId,
            organizationId: context.user.organizationId
        }
    }

    throw new Error("Agent storage context is unavailable. Run this tool during a production agent run with x-terse-run-id.")
}
