import { ConfigInstance, ConfigType } from "@/shared/Configs"
import { TransientKnowledgeBase } from "@/shared/types"

import { DatadogKnowledgeBaseIntegration } from "./DatadogKnowledgeBaseIntegration"
import { GitHubKnowledgeBaseIntegration } from "./GitHubKnowledgeBaseIntegration"
import { LaunchDarklyKnowledgeBaseIntegration } from "./LaunchDarklyKnowledgeBaseIntegration"
import { PostHogKnowledgeBaseIntegration } from "./PostHogKnowledgeBaseIntegration"

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

        default:
            throw new Error(`Unsupported knowledge base config type: ${props.knowledgeBase.configType}`)
    }
}
