import { KnowledgeBaseConfigType } from "@prisma/client";
import { KnowledgeBase } from "./KnowledgeBase";
import { Session } from "../../server";
import { ConfigInstance } from "../../shared/Configs";
import { PosthogKnowledgeBase } from "../posthog/PosthogKnowledgeBase";
import { GitHubKnowledgeBase } from "../github/GitHubKnowledgeBase";
import { DatadogKnowledgeBase } from "../datadog/DatadogKnowledgeBase";

/**
 * Factory for creating KnowledgeBase instances based on KnowledgeBaseConfigType.
 * Uses a registry pattern to map knowledge base types to their corresponding KnowledgeBase implementations.
 * No switch statements - each knowledge base type is registered independently.
 */
export class KnowledgeBaseFactory {
    public static readonly KNOWLEDGE_BASE_REGISTRY: Map<KnowledgeBaseConfigType, () => KnowledgeBase<Session, ConfigInstance>> = new Map<KnowledgeBaseConfigType, () => KnowledgeBase<Session, ConfigInstance>>([
        [KnowledgeBaseConfigType.POSTHOG, () => new PosthogKnowledgeBase()],
        [KnowledgeBaseConfigType.GITHUB, () => new GitHubKnowledgeBase()],
        [KnowledgeBaseConfigType.DATADOG, () => new DatadogKnowledgeBase()],
    ]);

    /**
     * Create a KnowledgeBase instance for the given knowledge base type.
     * @param knowledgeBaseType The knowledge base type to create
     * @returns A KnowledgeBase instance, or null if the type is not supported
     */
    static createKnowledgeBase(knowledgeBaseType: KnowledgeBaseConfigType): KnowledgeBase<Session, ConfigInstance> | null {
        const factory = this.KNOWLEDGE_BASE_REGISTRY.get(knowledgeBaseType);
        if (!factory) {
            return null;
        }
        return factory();
    }

    /**
     * Create KnowledgeBase instances from a list of knowledge base config types.
     * @param knowledgeBaseTypes Array of knowledge base config types
     * @returns Array of KnowledgeBase instances (null entries are filtered out)
     */
    static createKnowledgeBases(knowledgeBaseTypes: KnowledgeBaseConfigType[]): KnowledgeBase<Session, ConfigInstance>[] {
        return knowledgeBaseTypes
            .map(type => this.createKnowledgeBase(type))
            .filter((kb): kb is KnowledgeBase<Session, ConfigInstance> => kb !== null);
    }

    /**
     * Check if a knowledge base type is supported.
     * @param knowledgeBaseType The knowledge base type to check
     * @returns true if the knowledge base type is supported
     */
    static isSupported(knowledgeBaseType: KnowledgeBaseConfigType): boolean {
        return this.KNOWLEDGE_BASE_REGISTRY.has(knowledgeBaseType);
    }
}

