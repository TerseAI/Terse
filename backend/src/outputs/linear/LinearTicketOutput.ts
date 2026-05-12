import { OutputConfigType } from "@prisma/client"
import { LinearOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { validateLinearProjectExists, validateLinearTeamExists } from "../../integrations/LinearIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output } from "../abstract/Output"

import { linearAddCommentTool, validateLinearAddComment } from "./tools/addComment"
import { linearCreateTicketTool, validateLinearCreateTicket } from "./tools/createTicket"
import { linearGetLabelsTool, validateLinearGetLabels } from "./tools/getLabels"
import { linearGetProjectsTool, validateLinearGetProjects } from "./tools/getProjects"
import { linearGetStatesTool, validateLinearGetStates } from "./tools/getStates"
import { linearGetTeamsTool, validateLinearGetTeams } from "./tools/getTeams"
import { linearGetUsersTool, validateLinearGetUsers } from "./tools/getUsers"
import { linearReadTicketTool, validateLinearReadTicket } from "./tools/readTicket"
import { linearSearchTicketTool, validateLinearSearchTicket } from "./tools/searchTicket"
import { linearUpdateTicketTool, validateLinearUpdateTicket } from "./tools/updateTicket"

export class LinearTicketOutput extends Output<LinearOutputConfig> {
    constructor() {
        const toolbox = [
            { tool: linearSearchTicketTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Search tickets", validateACL: validateLinearSearchTicket },
            { tool: linearGetTeamsTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get teams", validateACL: validateLinearGetTeams },
            { tool: linearGetStatesTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get states", validateACL: validateLinearGetStates },
            { tool: linearGetLabelsTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get labels", validateACL: validateLinearGetLabels },
            { tool: linearGetProjectsTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get projects", validateACL: validateLinearGetProjects },
            { tool: linearGetUsersTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get users", validateACL: validateLinearGetUsers },
            { tool: linearCreateTicketTool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Create ticket", validateACL: validateLinearCreateTicket },
            { tool: linearUpdateTicketTool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Update ticket", validateACL: validateLinearUpdateTicket },
            { tool: linearAddCommentTool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Add comment", validateACL: validateLinearAddComment },
            { tool: linearReadTicketTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Read ticket", validateACL: validateLinearReadTicket }
        ]
        super(OutputConfigType.LINEAR_TICKET, toolbox)
    }

    async validateConfig(output: LinearOutputConfig, _userId: string): Promise<void> {
        if (output.teamId) {
            await validateLinearTeamExists(output.integrationId, output.teamId)
        }
        if (output.projectId) {
            await validateLinearProjectExists(output.integrationId, output.projectId)
        }
    }

    async addOutputToAgent(tx: PrismaTransaction, channelOutputId: string, output: LinearOutputConfig): Promise<void> {
        await tx.automation_linear_configs.create({
            data: {
                automation_output_id: channelOutputId,
                team_id: output.teamId || null,
                team_name: output.teamName || null,
                project_id: output.projectId || null
            }
        })
    }

    protected getSystemInstructionsForConfigs(configs: LinearOutputConfig[]): string {
        if (configs.length === 0) {
            throw new Error("No Linear configs provided")
        }

        const sections: string[] = []
        sections.push("=== LINEAR TICKET OUTPUT ===")

        // List all available configurations
        const configList: string[] = []
        for (const config of configs) {
            const teamId = config.teamId
            const teamName = config.teamName
            const projectId = config.projectId
            configList.push(`  • Integration ID: ${config.integrationId} - Team Name: ${teamName || "N/A"}, Team ID: ${teamId || "N/A"}, Project ID: ${projectId || "N/A"}`)
        }
        sections.push("Available configurations:")
        sections.push(configList.join("\n"))
        sections.push("\nWhen calling Linear tools, you MUST include the `integrationId` parameter matching one of the integration IDs listed above.")

        return sections.join("\n")
    }
}
