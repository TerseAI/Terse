import { Runner } from "@openai/agents-core"

import { User } from "../shared/types"

export enum AgentType {
    AGENT_RUNNER = "agent_runner",
    CHAT = "chat",
    EVENT_SUMMARY = "event_summary",
    APPROVAL_SUMMARY = "approval_summary",
    DIRECTIVE = "directive",
    FILTER = "filter",
    GITHUB_SUMMARIZER = "github_summarizer"
}

type RunnerConfig = {
    agentId: string
    agentType: AgentType
    runId?: string
    user: User
    env: string
}

/**
 * Creates a new runner instance with the given configuration, enabling visibility into an agent run in the UI.
 * Runner-level modelSettings.providerData injects PostHog analytics context (distinctId, groups, properties)
 * so that all LLM calls made by this runner are attributed to the correct user and organization.
 * Note: Agent-level providerData (e.g. from AgentRunner.initializeAgent) takes precedence via shallow merge.
 * @param config - The configuration for the runner.
 * @returns
 */
export function runnerFactory(config: RunnerConfig): Runner {
    return new Runner({
        traceMetadata: {
            agentId: config.agentId,
            runId: config?.runId ?? "",
            userId: config.user.id,
            env: config.env
        }
    })
}

export const builderProviderDataModelSettings = (config: RunnerConfig) => {
    return {
        providerData: {
            posthogDistinctId: config.user.email,
            posthogProperties: {
                organizationId: config.user.organizationId,
                organizationName: config.user.organizationName,
                agentId: config.agentId,
                agentType: config.agentType,
                runId: config?.runId ?? "",
                userName: config.user.displayName,
                environment: config.env
            },
            ...(config.user.organizationId ? { posthogGroups: { company: config.user.organizationId } } : {})
        }
    }
}
