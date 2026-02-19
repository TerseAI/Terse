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

        const toolsByIntegration: string[] = []
        for (const config of configs) {
            const availableTools = ["listWorkOSUsers", "getWorkOSUser"]
            toolsByIntegration.push(`  Integration ID ${config.integration_id}: ${availableTools.join(", ")}`)
        }

        sections.push("\nAVAILABLE TOOLS BY INTEGRATION:")
        sections.push(toolsByIntegration.join("\n"))
        sections.push("\nTOOL DESCRIPTIONS:")

        sections.push(
            "• listWorkOSUsers: List users from the WorkOS account. " +
                "Supports filtering by email address and organization ID. " +
                "Returns user profiles with email, name, verification status, and timestamps. " +
                "Supports pagination via the 'after' cursor."
        )
        sections.push(
            "• getWorkOSUser: Get detailed information about a specific user by their WorkOS user ID. " + "Returns full profile data including email, name, verification status, and timestamps."
        )

        sections.push(`
USAGE GUIDELINES:
- Use listWorkOSUsers to search for users by email or to browse all users.
- Use getWorkOSUser when you have a specific user ID and need their details.
- When searching for a user by email, use the email filter parameter in listWorkOSUsers.
- Paginate through results using the 'after' cursor when there are many users.`)

        return sections.join("\n")
    }
}
