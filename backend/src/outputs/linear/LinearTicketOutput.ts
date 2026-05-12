import { Tool } from "@openai/agents"
import { OutputConfigType } from "@prisma/client"
import { LinearOutputConfig } from "terse-types"
import { IntegrationType } from "terse-types"
import { ToolName } from "terse-types"

import { validateLinearProjectExists, validateLinearTeamExists } from "../../integrations/LinearIntegration"
import { PrismaTransaction } from "../../types/prisma"
import { Output, ToolACLValidator, defineToolEntry } from "../abstract/Output"

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
        const t = defineToolEntry<LinearOutputConfig>()
        const toolbox = [
            t({ tool: linearSearchTicketTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Search tickets", validateACL: validateLinearSearchTicket }),
            t({ tool: linearGetTeamsTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get teams", validateACL: validateLinearGetTeams }),
            t({ tool: linearGetStatesTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get states", validateACL: validateLinearGetStates }),
            t({ tool: linearGetLabelsTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get labels", validateACL: validateLinearGetLabels }),
            t({ tool: linearGetProjectsTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get projects", validateACL: validateLinearGetProjects }),
            t({ tool: linearGetUsersTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Get users", validateACL: validateLinearGetUsers }),
            t({ tool: linearCreateTicketTool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Create ticket", validateACL: validateLinearCreateTicket }),
            t({ tool: linearUpdateTicketTool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Update ticket", validateACL: validateLinearUpdateTicket }),
            t({ tool: linearAddCommentTool, isReadOnly: false, integration: IntegrationType.LINEAR, displayName: "Add comment", validateACL: validateLinearAddComment }),
            t({ tool: linearReadTicketTool, isReadOnly: true, integration: IntegrationType.LINEAR, displayName: "Read ticket", validateACL: validateLinearReadTicket })
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

type LinearACL<TName extends ToolName> = ToolACLValidator<TName, LinearOutputConfig>

const validateLinearSearchTicket: LinearACL<"linear_search_ticket"> = _params => ({ ok: true as const })
const validateLinearGetTeams: LinearACL<"linear_get_teams"> = _params => ({ ok: true as const })
const validateLinearGetStates: LinearACL<"linear_get_states"> = _params => ({ ok: true as const })
const validateLinearGetLabels: LinearACL<"linear_get_labels"> = _params => ({ ok: true as const })
const validateLinearGetProjects: LinearACL<"linear_get_projects"> = _params => ({ ok: true as const })
const validateLinearGetUsers: LinearACL<"linear_get_users"> = _params => ({ ok: true as const })
const validateLinearCreateTicket: LinearACL<"linear_create_ticket"> = _params => ({ ok: true as const })
const validateLinearUpdateTicket: LinearACL<"linear_update_ticket"> = _params => ({ ok: true as const })
const validateLinearAddComment: LinearACL<"linear_add_comment"> = _params => ({ ok: true as const })
const validateLinearReadTicket: LinearACL<"linear_read_ticket"> = _params => ({ ok: true as const })
