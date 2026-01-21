import { KnowledgeBaseConfigType } from "@prisma/client";
import { KnowledgeBase } from "./KnowledgeBase";
import { ConfigInstance } from "../../shared/Configs";
import { PosthogKnowledgeBase } from "../posthog/PosthogKnowledgeBase";
import { GitHubKnowledgeBase } from "../github/GitHubKnowledgeBase";
import { LaunchDarklyKnowledgeBase } from "../launchdarkly/LaunchDarklyKnowledgeBase";
import { DatadogKnowledgeBase } from "../datadog/DatadogKnowledgeBase";
import { ChannelKnowledgeBaseWithConfigs, ChannelWithRelations } from "../../types/prisma";


export class KnowledgeBaseFactory {
    public static readonly KNOWLEDGE_BASE_REGISTRY: Map<KnowledgeBaseConfigType, () => KnowledgeBase<ConfigInstance>> = new Map<KnowledgeBaseConfigType, () => KnowledgeBase<ConfigInstance>>([
        [KnowledgeBaseConfigType.POSTHOG, () => new PosthogKnowledgeBase()],
        [KnowledgeBaseConfigType.GITHUB, () => new GitHubKnowledgeBase()],
        [KnowledgeBaseConfigType.LAUNCHDARKLY, () => new LaunchDarklyKnowledgeBase()],
        [KnowledgeBaseConfigType.DATADOG, () => new DatadogKnowledgeBase()],
    ]);

    /**
     * Create a KnowledgeBase instance for the given knowledge base type.
     * @param knowledgeBaseType The knowledge base type to create
     * @returns A KnowledgeBase instance, or null if the type is not supported
     */
    static createKnowledgeBase(knowledgeBaseType: KnowledgeBaseConfigType): KnowledgeBase<ConfigInstance> | null {
        const factory = this.KNOWLEDGE_BASE_REGISTRY.get(knowledgeBaseType);
        if (!factory) {
            return null;
        }
        return factory();
    }

    static createKnowledgeBaseWithConfigs(kbType: KnowledgeBaseConfigType, configs: ChannelKnowledgeBaseWithConfigs[]): KnowledgeBase<ConfigInstance> | null {
        const kb = this.createKnowledgeBase(kbType);
        if (!kb) {
            return null;
        }
        kb.configs = configs;
        return kb;
    }

    static createKnowledgeBasesFromChannel(
        channelKnowledgeBases: ChannelWithRelations['knowledge_bases']
    ): KnowledgeBase<ConfigInstance>[] {
        if (!channelKnowledgeBases || channelKnowledgeBases.length === 0) {
            return [];
        }

        // Group configs by type
        const configsByType = new Map<KnowledgeBaseConfigType, ChannelKnowledgeBaseWithConfigs[]>();
        for (const channelKnowledgeBase of channelKnowledgeBases) {
            const configType = channelKnowledgeBase.config_type as KnowledgeBaseConfigType;
            if (!configsByType.has(configType)) {
                configsByType.set(configType, []);
            }
            configsByType.get(configType)!.push(channelKnowledgeBase as ChannelKnowledgeBaseWithConfigs);
        }

        // Create one knowledge base instance per type with all configs of that type
        const knowledgeBases: KnowledgeBase<ConfigInstance>[] = [];
        for (const [configType, configs] of configsByType.entries()) {
            const kb = this.createKnowledgeBaseWithConfigs(configType, configs);
            if (kb) {
                knowledgeBases.push(kb);
            }
        }
        
        return knowledgeBases;
    }
}

