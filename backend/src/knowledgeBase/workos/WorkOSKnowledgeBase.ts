import { Tool } from "@openai/agents"
import { KnowledgeBaseConfigType } from "@prisma/client"

import { buildDummyKnowledgeBaseConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { ToolboxEntry } from "../../outputs/abstract/Output"
import { ConfigType, WorkOSKBConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction } from "../../types/prisma"
import { WorkOSKnowledgeBaseConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { KnowledgeBase } from "../abstract/KnowledgeBase"

import { getWorkOSUserTool } from "./tools/getUser"
import { listWorkOSUsersTool } from "./tools/listUsers"

/**
 * WorkOS Knowledge Base implementation.
 * Provides tools for fetching and searching users from a customer's WorkOS account.
 */
export class WorkOSKnowledgeBase extends KnowledgeBase<WorkOSKBConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: listWorkOSUsersTool as Tool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "List users" },
            { tool: getWorkOSUserTool as Tool, isReadOnly: true, integration: IntegrationType.WORKOS, displayName: "Get user" }
        ]

        super(KnowledgeBaseConfigType.WORKOS, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.WORKOS_KB)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.WORKOS_KB,
            integrationType: meta.integrationType,
            role: CapabilityRole.KNOWLEDGE_BASE,
            tools,
            configFields: {
                integrationId: "WorkOS integration connection"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentKnowledgeBaseWithConfigs {
        return buildDummyKnowledgeBaseConfig("example", {
            config_type: KnowledgeBaseConfigType.WORKOS
        })
    }

    async validateConfig(knowledgeBase: WorkOSKBConfig, _userId: string): Promise<void> {
        WorkOSKnowledgeBaseConfigSchema.parse(stripConfigForValidation(knowledgeBase))
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, channelKnowledgeBaseId: string, _knowledgeBase: WorkOSKBConfig): Promise<void> {
        await tx.automation_workos_kb_configs.create({
            data: {
                automation_knowledge_base_id: channelKnowledgeBaseId
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentKnowledgeBaseWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No WorkOS KB configs provided")
        }

        const sections: string[] = []

        sections.push("=== WORKOS KNOWLEDGE BASE ===")

        const configList: string[] = []
        for (const config of configs) {
            configList.push(`  • Integration ID: ${config.integration_id}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling WorkOS tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        return sections.join("\n")
    }
}
