import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"

import { buildDummyOutputConfig } from "../../buildDummyConfigForCapability"
import { type CapabilityDescription, CapabilityRole, extractToolMetadata, getConfigMetadata } from "../../capabilityHelpers"
import { validateLinearTeamExists } from "../../integrations/LinearIntegration"
import { db } from "../../prismaClient"
import { LinearOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { AgentOutputWithConfigs, PrismaTransaction } from "../../types/prisma"
import { LinearOutputConfigSchema, stripConfigForValidation } from "../../utility/configSchemas"
import { convertOutputConfigTypeToConfigType } from "../../utility/typeConverters"
import { Output, ToolboxEntry } from "../abstract/Output"

import { linearAddCommentTool } from "./tools/addComment"
import { linearCreateTicketTool } from "./tools/createTicket"
import { linearGetLabelsTool } from "./tools/getLabels"
import { linearGetProjectsTool } from "./tools/getProjects"
import { linearGetStatesTool } from "./tools/getStates"
import { linearGetTeamsTool } from "./tools/getTeams"
import { linearGetUsersTool } from "./tools/getUsers"
import { linearReadTicketTool } from "./tools/readTicket"
import { linearSearchTicketTool } from "./tools/searchTicket"
import { linearUpdateTicketTool } from "./tools/updateTicket"

export class LinearTicketOutput extends Output<LinearOutputConfig> {
    constructor() {
        const toolbox: ToolboxEntry[] = [
            { tool: linearSearchTicketTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Search tickets" },
            { tool: linearGetTeamsTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get teams" },
            { tool: linearGetStatesTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get states" },
            { tool: linearGetLabelsTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get labels" },
            { tool: linearGetProjectsTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get projects" },
            { tool: linearGetUsersTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get users" },
            { tool: linearCreateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Create ticket" },
            { tool: linearUpdateTicketTool as Tool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Update ticket" },
            { tool: linearAddCommentTool as Tool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Add comment" },
            { tool: linearReadTicketTool as Tool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Read ticket" }
        ]
        super(OutputConfigType.LINEAR_TICKET, toolbox)
    }

    getCapabilityDescription(): CapabilityDescription {
        const configType = convertOutputConfigTypeToConfigType(OutputConfigType.LINEAR_TICKET)
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
                integrationId: "Linear integration connection",
                teamId: "Linear team ID",
                teamName: "Team display name"
            },
            systemInstructions
        }
    }

    protected getDummyConfigForCapability(): AgentOutputWithConfigs {
        return buildDummyOutputConfig("example", {
            config_type: OutputConfigType.LINEAR_TICKET,
            linear_config: {
                team_id: "team-123",
                team_name: "Example Team"
            }
        })
    }

    async validateConfig(output: LinearOutputConfig, _userId: string): Promise<void> {
        LinearOutputConfigSchema.parse(stripConfigForValidation(output))
        if (!output.teamId) {
            throw new Error("Invalid output config for linear_output: missing teamId")
        }
        await validateLinearTeamExists(output.integrationId, output.teamId)
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: LinearOutputConfig): Promise<void> {
        await tx.automation_linear_configs.create({
            data: {
                automation_output_id: channelOutputId,
                team_id: output.teamId || null,
                team_name: output.teamName || null
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: AgentOutputWithConfigs[]): string {
        if (configs.length === 0) {
            throw new Error("No Linear configs provided")
        }

        const sections: string[] = []
        sections.push("=== LINEAR TICKET OUTPUT ===")

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            if (!config.linear_config) {
                throw new Error("Linear config not found")
            }
            const teamId = config.linear_config.team_id
            const teamName = config.linear_config.team_name
            configList.push(`  • Integration ID: ${config.integration_id} - Team Name: ${teamName || "N/A"}, Team ID: ${teamId || "N/A"}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Linear tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        return sections.join("\n")
    }
}
