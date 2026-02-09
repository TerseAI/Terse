import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { JiraConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"

import { jiraCreateTicketTool } from "./tools/createTicket"
import { jiraSearchTicketTool } from "./tools/searchTicket"
import { jiraUpdateTicketTool } from "./tools/updateTicket"

export class JiraTicketOutput extends Output<JiraConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: jiraSearchTicketTool as Tool, isReadOnly: true, integration: IntegrationType.ATLASSIAN, displayName: "Search tickets" },
            { tool: jiraCreateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.ATLASSIAN, displayName: "Create ticket" },
            { tool: jiraUpdateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.ATLASSIAN, displayName: "Update ticket" }
        ]
        super(OutputConfigType.JIRA_TICKET, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.JIRA_TICKET)
        const meta = getConfigMetadata(configType)
        const tools = extractToolMetadata(this.toolbox)
        const systemInstructions = this.getSystemInstructions(true)

        return {
            name: meta.name,
            description: meta.description,
            configType,
            integrationType: meta.integrationType,
            role: CapabilityRole.OUTPUT,
            tools,
            configFields: {
                integrationId: "Atlassian/Jira integration connection",
                projectKey: "Jira project key (optional)",
                projectId: "Jira project ID (optional)"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.JIRA_TICKET,
            jira_config: {
                project_key: "PROJ",
                project_id: "12345"
            }
        })
    }

    async validateConfig(_output: JiraConfig, _userId: string): Promise<void> {
        // No additional config validation beyond integration ownership.
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: JiraConfig): Promise<void> {
        await tx.automation_jira_configs.create({
            data: {
                automation_output_id: channelOutputId,
                project_key: output.projectKey || null,
                project_id: output.projectId || null
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Jira configs provided")
        }

        const sections: string[] = []
        sections.push("=== JIRA TICKET OUTPUT ===")

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            if (!config.jira_config) {
                throw new Error("Jira config not found")
            }
            const projectKey = config.jira_config.project_key
            const projectId = config.jira_config.project_id
            configList.push(`  • Integration ID: ${config.integration_id} - Project Key: ${projectKey || "N/A"}, Project ID: ${projectId || "N/A"}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Jira tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        return sections.join("\n")
    }
}
