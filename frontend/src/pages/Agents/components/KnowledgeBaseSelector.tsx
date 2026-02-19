import { ConfigInstance, ConfigType } from "@/shared/Configs"
import { TransientKnowledgeBase } from "@/shared/types"

import { DatadogKnowledgeBaseIntegration } from "./DatadogKnowledgeBaseIntegration"
import { GitHubKnowledgeBaseIntegration } from "./GitHubKnowledgeBaseIntegration"
import { LaunchDarklyKnowledgeBaseIntegration } from "./LaunchDarklyKnowledgeBaseIntegration"
import { LinearKnowledgeBaseIntegration } from "./LinearKnowledgeBaseIntegration"
import { PostHogKnowledgeBaseIntegration } from "./PostHogKnowledgeBaseIntegration"
import { SlackKnowledgeBaseIntegration } from "./SlackKnowledgeBaseIntegration"
import { WorkOSKnowledgeBaseIntegration } from "./WorkOSKnowledgeBaseIntegration"

export interface KnowledgeBaseSelectorProps {
    knowledgeBase: TransientKnowledgeBase
    variant: "card" | "dialog"
    setConfig: (config: ConfigInstance) => void
}

export function KnowledgeBaseSelector(props: KnowledgeBaseSelectorProps) {
    switch (props.knowledgeBase.config?.configType || props.knowledgeBase.configType) {
        case ConfigType.POSTHOG:
            return <PostHogKnowledgeBaseIntegration {...props} />
        case ConfigType.GITHUB_KB:
            return <GitHubKnowledgeBaseIntegration {...props} />
        case ConfigType.LAUNCHDARKLY:
            return <LaunchDarklyKnowledgeBaseIntegration {...props} />
        case ConfigType.DATADOG:
            return <DatadogKnowledgeBaseIntegration {...props} />
        case ConfigType.LINEAR_KB:
            return <LinearKnowledgeBaseIntegration {...props} />
        case ConfigType.SLACK_KB:
            return <SlackKnowledgeBaseIntegration {...props} />
        case ConfigType.WORKOS_KB:
            return <WorkOSKnowledgeBaseIntegration {...props} />

        default:
            throw new Error(`Unsupported knowledge base config type: ${props.knowledgeBase.configType}`)
    }
}
