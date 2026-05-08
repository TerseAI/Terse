import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"
import { LinearOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"

import { validateLinearProjectExists, validateLinearTeamExists } from "../../integrations/LinearIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output, defineToolboxEntry, outputIsReadOnly } from "../abstract/Output"

import { validateLinearCreateTicketACL, validateLinearIntegrationACL, validateLinearTeamScopedACL, validateLinearUpdateTicketACL } from "./acl"
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
        const toolbox = [
            defineToolboxEntry({
                tool: linearSearchTicketTool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Search tickets",
                validateACL: validateLinearIntegrationACL
            }),
            defineToolboxEntry({
                tool: linearGetTeamsTool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Get teams",
                validateACL: validateLinearIntegrationACL
            }),
            defineToolboxEntry({
                tool: linearGetStatesTool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Get states",
                validateACL: validateLinearTeamScopedACL
            }),
            defineToolboxEntry({
                tool: linearGetLabelsTool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Get labels",
                validateACL: validateLinearTeamScopedACL
            }),
            defineToolboxEntry({
                tool: linearGetProjectsTool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Get projects",
                validateACL: validateLinearTeamScopedACL
            }),
            defineToolboxEntry({
                tool: linearGetUsersTool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Get users",
                validateACL: validateLinearIntegrationACL
            }),
            defineToolboxEntry({
                tool: linearCreateTicketTool,
                isReadOnly: false,
                integration: IntegrationType.LINEAR,
                displayName: "Create ticket",
                validateACL: validateLinearCreateTicketACL
            }),
            defineToolboxEntry({
                tool: linearUpdateTicketTool,
                isReadOnly: false,
                integration: IntegrationType.LINEAR,
                displayName: "Update ticket",
                validateACL: validateLinearUpdateTicketACL
            }),
            defineToolboxEntry({
                tool: linearAddCommentTool,
                isReadOnly: false,
                integration: IntegrationType.LINEAR,
                displayName: "Add comment",
                validateACL: validateLinearIntegrationACL
            }),
            defineToolboxEntry({
                tool: linearReadTicketTool,
                isReadOnly: true,
                integration: IntegrationType.LINEAR,
                displayName: "Read ticket",
                validateACL: validateLinearIntegrationACL
            })
        ]
        super(OutputConfigType.LINEAR_TICKET, toolbox)
    }

    protected getDummyConfigForCapability(): LinearOutputConfig {
        return new LinearOutputConfig("example", "team-123", "Example Team")
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

        const readOnly = outputIsReadOnly(configs)

        const sections: string[] = []
        sections.push(readOnly ? "=== LINEAR TICKET OUTPUT (READ-ONLY) ===" : "=== LINEAR TICKET OUTPUT ===")

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

        if (readOnly) {
            sections.push(
                "\nThis Linear integration is read-only for this run. You can search and read tickets, list teams/states/labels/projects/users, but cannot create tickets, update tickets, or add comments."
            )
        }

        return sections.join("\n")
    }
}
