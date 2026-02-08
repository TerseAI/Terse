import { RunContext, tool } from "@openai/agents"
import { Tool } from "@openai/agents-core"
import { z } from "zod"

import type { CapabilityDescription } from "../../capabilityHelpers"
import { KnowledgeBaseFactory } from "../../knowledgeBase/abstract/KnowledgeBaseFactory"
import { OutputFactory } from "../../outputs/abstract/OutputFactory"
import { IntegrationType } from "../../shared/Integrations"
import { TRIGGER_REGISTRY } from "../../triggers/TriggerRegistry"

import type { ChatAgentContext } from "./ChatAgentContext"

export enum CapabilityLookupCategory {
    TRIGGERS = "triggers",
    KNOWLEDGE_BASES = "knowledgeBases",
    OUTPUTS = "outputs",
    ALL = "all"
}

function gatherTriggerCapabilities(filter?: IntegrationType): CapabilityDescription[] {
    return TRIGGER_REGISTRY.map(t => t.getCapabilityDescription()).filter(c => !filter || c.integrationType === filter)
}

function gatherKBCapabilities(filter?: IntegrationType): CapabilityDescription[] {
    const results: CapabilityDescription[] = []
    for (const [, factory] of KnowledgeBaseFactory.KNOWLEDGE_BASE_REGISTRY) {
        const kb = factory()
        const cap = kb.getCapabilityDescription()
        if (!filter || cap.integrationType === filter) results.push(cap)
    }
    return results
}

function gatherOutputCapabilities(filter?: IntegrationType): CapabilityDescription[] {
    const results: CapabilityDescription[] = []
    for (const [, factory] of OutputFactory.OUTPUT_REGISTRY) {
        const output = factory()
        const cap = output.getCapabilityDescription()
        if (!filter || cap.integrationType === filter) results.push(cap)
    }
    return results
}

export const lookupPlatformCapabilitiesTool = tool({
    name: "lookupPlatformCapabilities",
    description:
        "Look up what triggers, knowledge bases, or outputs the platform supports. Use when: a user asks whether agents can do something -- always check this tool instead of guessing; a user asks what an agent can do with a specific integration; you need to know what tools a knowledge base or output provides; you need to verify what configuration fields a trigger requires; a user asks about platform capabilities in general.",
    parameters: z.object({
        category: z.nativeEnum(CapabilityLookupCategory),
        integration: z.nativeEnum(IntegrationType).nullable()
    }),
    execute: async ({ category, integration }: { category: CapabilityLookupCategory; integration: IntegrationType | null }, _runContext?: RunContext<ChatAgentContext>): Promise<string> => {
        const filter = integration ?? undefined

        if (category === CapabilityLookupCategory.ALL) {
            const triggers = gatherTriggerCapabilities(filter)
            const knowledgeBases = gatherKBCapabilities(filter)
            const outputs = gatherOutputCapabilities(filter)
            return JSON.stringify({
                [CapabilityLookupCategory.TRIGGERS]: triggers,
                [CapabilityLookupCategory.KNOWLEDGE_BASES]: knowledgeBases,
                [CapabilityLookupCategory.OUTPUTS]: outputs
            })
        }

        if (category === CapabilityLookupCategory.TRIGGERS) {
            const caps = gatherTriggerCapabilities(filter)
            return JSON.stringify(caps)
        }

        if (category === CapabilityLookupCategory.KNOWLEDGE_BASES) {
            const caps = gatherKBCapabilities(filter)
            return JSON.stringify(caps)
        }

        const caps = gatherOutputCapabilities(filter)
        return JSON.stringify(caps)
    }
}) as Tool<ChatAgentContext>
