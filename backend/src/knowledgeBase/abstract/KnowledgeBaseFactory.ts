import { KnowledgeBaseConfigType } from "@prisma/client"

import { ConfigInstance } from "../../shared/Configs"
import { AgentKnowledgeBaseWithConfigs, AgentWithRelations } from "../../types/prisma"
import { DatadogKnowledgeBase } from "../datadog/DatadogKnowledgeBase"
import { GitHubKnowledgeBase } from "../github/GitHubKnowledgeBase"
import { LaunchDarklyKnowledgeBase } from "../launchdarkly/LaunchDarklyKnowledgeBase"
import { PosthogKnowledgeBase } from "../posthog/PosthogKnowledgeBase"

import { KnowledgeBase } from "./KnowledgeBase"

export class KnowledgeBaseFactory {
    public static readonly KNOWLEDGE_BASE_REGISTRY: Map<KnowledgeBaseConfigType, () => KnowledgeBase<ConfigInstance>> = new Map<KnowledgeBaseConfigType, () => KnowledgeBase<ConfigInstance>>([
        [KnowledgeBaseConfigType.POSTHOG, () => new PosthogKnowledgeBase()],
        [KnowledgeBaseConfigType.GITHUB, () => new GitHubKnowledgeBase()],
        [KnowledgeBaseConfigType.LAUNCHDARKLY, () => new LaunchDarklyKnowledgeBase()],
        [KnowledgeBaseConfigType.DATADOG, () => new DatadogKnowledgeBase()]
    ])

    /**
     * Create a KnowledgeBase instance for the given knowledge base type.
     * @param knowledgeBaseType The knowledge base type to create
     * @returns A KnowledgeBase instance, or null if the type is not supported
     */
    static createKnowledgeBase(knowledgeBaseType: KnowledgeBaseConfigType): KnowledgeBase<ConfigInstance> | null {
        const factory = this.KNOWLEDGE_BASE_REGISTRY.get(knowledgeBaseType)
        if (!factory) {
            return null
        }
        return factory()
    }

    static createKnowledgeBaseWithConfigs(kbType: KnowledgeBaseConfigType, configs: AgentKnowledgeBaseWithConfigs[]): KnowledgeBase<ConfigInstance> | null {
        const kb = this.createKnowledgeBase(kbType)
        if (!kb) {
            return null
        }
        kb.configs = configs
        return kb
    }

    static createKnowledgeBasesFromAgent(agentKnowledgeBases: AgentWithRelations["knowledge_bases"]): KnowledgeBase<ConfigInstance>[] {
        if (!agentKnowledgeBases || agentKnowledgeBases.length === 0) {
            return []
        }

        // Group configs by type
        const configsByType = new Map<KnowledgeBaseConfigType, AgentKnowledgeBaseWithConfigs[]>()
        for (const agentKnowledgeBase of agentKnowledgeBases) {
            const configType = agentKnowledgeBase.config_type as KnowledgeBaseConfigType
            if (!configsByType.has(configType)) {
                configsByType.set(configType, [])
            }
            configsByType.get(configType)!.push(agentKnowledgeBase as AgentKnowledgeBaseWithConfigs)
        }

        // Create one knowledge base instance per type with all configs of that type
        const knowledgeBases: KnowledgeBase<ConfigInstance>[] = []
        for (const [configType, configs] of configsByType.entries()) {
            const kb = this.createKnowledgeBaseWithConfigs(configType, configs)
            if (kb) {
                knowledgeBases.push(kb)
            }
        }

        return knowledgeBases
    }
}
