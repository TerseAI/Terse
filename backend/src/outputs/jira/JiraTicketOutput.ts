import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { validateJiraProjectExists } from "../../integrations/AtlassianIntegration"
import { JiraConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { PrismaTransaction } from "../../types/prisma"
import { JiraConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
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

    protected getDummyConfigForCapability(): JiraConfig {
        return new JiraConfig("example", "PROJ", "12345")
    }

    async validateConfig(output: JiraConfig, _userId: string): Promise<void> {
        // Not doing schema validation here because
        // it errors out. TODO: fix this.
        if (output.projectKey) {
            await validateJiraProjectExists(output.integrationId, output.projectKey)
        }
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

    protected getSystemInstructionsForConfigs(configs: JiraConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Jira configs provided")
        }

        const sections: string[] = []
        sections.push("=== JIRA TICKET OUTPUT ===")

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            const projectKey = config.projectKey
            const projectId = config.projectId
            configList.push(`  • Integration ID: ${config.integrationId} - Project Key: ${projectKey || "N/A"}, Project ID: ${projectId || "N/A"}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Jira tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        return sections.join("\n")
    }
}
