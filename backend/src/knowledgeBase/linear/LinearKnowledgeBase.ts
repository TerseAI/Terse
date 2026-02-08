import { Tool } from "@openai/agents"
import { KnowledgeBaseConfigType } from "@prisma/client"

import { buildDummyKnowledgeBaseConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { ToolboxEntry } from "../../outputs/abstract/Output"
import { linearSearchTicketTool } from "../../outputs/linear/tools/searchTicket"
import { ConfigType, LinearKBConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentKnowledgeBaseWithConfigs, PrismaTransaction } from "../../types/prisma"
import { KnowledgeBase } from "../abstract/KnowledgeBase"

import { linearReadTicketTool } from "./tools/readTicket"

/**
 * Linear Knowledge Base implementation.
 * Provides tools to search for and read Linear tickets (reusing output search tool).
 */
export class LinearKnowledgeBase extends KnowledgeBase<LinearKBConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            {
                tool: linearSearchTicketTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Search tickets"
            },
            {
                tool: linearReadTicketTool as Tool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Read ticket"
            }
        ]

        super(KnowledgeBaseConfigType.LINEAR, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const meta = getConfigMetadata(ConfigType.LINEAR_KB)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType: ConfigType.LINEAR_KB,
            integrationType: meta.integrationType,
            role: CapabilityRole.KNOWLEDGE_BASE,
            tools,
            configFields: {
                integrationId: "Linear integration connection",
                teamId: "Linear team ID (optional filter)",
                teamName: "Team display name",
                projectId: "Linear project ID (optional filter)",
                projectName: "Project display name"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentKnowledgeBaseWithConfigs {
        return buildDummyKnowledgeBaseConfig("example", {
            config_type: KnowledgeBaseConfigType.LINEAR,
            linear_kb_config: {
                team_id: "team-123",
                team_name: "Example Team",
                project_id: "proj-123",
                project_name: "Example Project"
            }
        })
    }

    async validateConfig(_knowledgeBase: LinearKBConfig, _userId: string): Promise<void> {
        // Linear KB only requires integrationId; no extra validation needed
    }

    async addKnowledgeBaseToAgent(tx: PrismaTransaction, agentKnowledgeBaseId: string, knowledgeBase: LinearKBConfig): Promise<void> {
        await tx.automation_linear_kb_configs.create({
            data: {
                automation_knowledge_base_id: agentKnowledgeBaseId,
                team_id: knowledgeBase.teamId ?? undefined,
                team_name: knowledgeBase.teamName ?? undefined,
                project_id: knowledgeBase.projectId ?? undefined,
                project_name: knowledgeBase.projectName ?? undefined
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentKnowledgeBaseWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Linear KB configs provided")
        }

        const sections: string[] = []
        sections.push("=== LINEAR KNOWLEDGE BASE ===")

        const configList: string[] = []
        for (const config of configs) {
            if (!config.linear_kb_config) {
                throw new Error("Linear KB config not found")
            }
            const c = config.linear_kb_config
            const parts = [`Integration ID: ${config.integration_id}`]
            if (c.team_name) parts.push(`Team: ${c.team_name}`)
            if (c.project_name) parts.push(`Project: ${c.project_name}`)
            configList.push(`  • ${parts.join(" - ")}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push(`
AVAILABLE TOOLS:
• linear_search_ticket: Search for Linear issues by query. Use to find tickets before reading details. Supports filtering by state using the stateNames parameter with values: Triage, Backlog, Todo, In Progress, In Review, Done, Canceled.
• linear_read_ticket: Read full ticket details including description and comments. Use issue ID (UUID) or identifier (e.g. TEAM-123).`)
        return sections.join("\n")
    }
}
