import { LinearClient } from "@linear/sdk"
import { IssueCreateInput } from "@linear/sdk/dist/_generated_documents"
import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { LinearIntegrationManager } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction, formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

const createTicketInputSchema = z.object({
    title: z.string().describe("The title of the ticket."),
    teamId: z.string().describe("The ID of the team to create the ticket in. Use linear_get_teams to find available teams."),
    description: z.string().nullable().optional().describe("The description of the ticket."),
    stateId: z.string().nullable().optional().describe("The ID of the state to create the ticket in. Use linear_get_states to find available states."),
    priority: z.number().nullable().optional().describe("The priority of the ticket. 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low."),
    projectId: z.string().nullable().optional().describe("The ID of the project to create the ticket in. Use linear_get_projects to find available projects."),
    labelIds: z.array(z.string()).nullable().optional().describe("The IDs of labels to add to the ticket. Use linear_get_labels to find available labels."),
    assigneeId: z.string().nullable().optional().describe("The ID of the user to assign the ticket to. Use linear_get_users to find available users and their IDs.")
})

export const linearCreateTicketTool = tool({
    name: ToolName.LINEAR_CREATE_TICKET,
    description: `Create a new Linear issue/ticket.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear workspace to use."),
        ticket: createTicketInputSchema
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.LINEAR_CREATE_TICKET),
    execute: async ({ integrationId, ticket }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_create_ticket tool", { integrationId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const manager = new LinearIntegrationManager()
        const accessToken = await manager.getAccessToken(integrationId)
        if (!accessToken) {
            throw new Error(`Linear integration not found or access denied for integrationId: ${integrationId}`)
        }

        const client = new LinearClient({ accessToken })

        try {
            const createTicketInput: IssueCreateInput = {
                title: ticket.title,
                teamId: ticket.teamId
            }
            if (ticket.description) {
                createTicketInput.description = ticket.description
            }
            if (ticket.stateId) {
                createTicketInput.stateId = ticket.stateId
            }
            if (ticket.projectId) {
                createTicketInput.projectId = ticket.projectId
            }
            if (ticket.labelIds) {
                createTicketInput.labelIds = ticket.labelIds
            }
            if (ticket.priority !== undefined && ticket.priority !== null) {
                createTicketInput.priority = ticket.priority
            }
            if (ticket.assigneeId) {
                createTicketInput.assigneeId = ticket.assigneeId
            }

            const payload = await client.createIssue(createTicketInput)

            const createdIssue = await payload.issue
            if (!createdIssue?.id) {
                throw new Error("Failed to create ticket")
            }
            const ticketData = await client.issue(createdIssue.id)

            const action = {
                action: "Created ticket",
                integration: IntegrationType.LINEAR,
                target: ticketData.identifier,
                details: `Created ticket: ${ticketData.identifier}`,
                type: RunHistoryActionType.create,
                url: ticketData.url
            }
            return {
                success: true,
                ticket: ticketData,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("❌ Error creating Linear ticket", { error: errorMessage, integrationId })
            return {
                success: false,
                error: errorMessage,
                hint: "Please check all inputs and try again."
            }
        }
    },
    errorFunction: formatError
})
