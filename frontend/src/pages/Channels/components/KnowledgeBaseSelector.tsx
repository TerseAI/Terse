import { TransientKnowledgeBase } from "@/shared/types";
import { ConfigInstance, ConfigType } from "@/shared/Configs";
import { PostHogKnowledgeBaseIntegration } from "./PostHogKnowledgeBaseIntegration";

export interface KnowledgeBaseSelectorProps {
    knowledgeBase: TransientKnowledgeBase;
    variant: 'card' | 'dialog';
    setConfig: (config: ConfigInstance) => void;
}

export function KnowledgeBaseSelector(props: KnowledgeBaseSelectorProps) {
    switch (props.knowledgeBase.config?.configType || props.knowledgeBase.configType) {
        case ConfigType.POSTHOG:
            return <PostHogKnowledgeBaseIntegration {...props} />;

        default:
            throw new Error(`Unsupported knowledge base config type: ${props.knowledgeBase.configType}`);
    }
}

