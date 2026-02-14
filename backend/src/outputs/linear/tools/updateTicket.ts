import { LinearClient } from "@linear/sdk"
import { IssueUpdateInput } from "@linear/sdk/dist/_generated_documents"
import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { LinearIntegrationManager } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { createNeedsApprovalFunction, formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

const updateTicketInputSchema = z.object({
    title: z.string().nullable().optional().describe("The updated title of the ticket."),
    description: z.string().nullable().optional().describe("The updated description of the ticket."),
    stateId: z.string().nullable().optional().describe("The ID of the state to set. Use linear_get_states to find available states."),
    priority: z.number().nullable().optional().describe("The priority of the ticket. 0 = No priority, 1 = Urgent, 2 = High, 3 = Normal, 4 = Low."),
    projectId: z.string().nullable().optional().describe("The ID of the project to associate with the ticket. Use linear_get_projects to find available projects."),
    labelIds: z.array(z.string()).nullable().optional().describe("The IDs of labels to add to the ticket. Use linear_get_labels to find available labels."),
    assigneeId: z.string().nullable().optional().describe("The ID of the user to assign the ticket to. Use linear_get_users to find available users and their IDs.")
})

export const linearUpdateTicketTool = tool({
    name: ToolName.LINEAR_UPDATE_TICKET,
    description: `Update an existing Linear issue/ticket. Use linear_search_ticket to find the issue ID, and linear_get_states, linear_get_users, linear_get_projects, linear_get_teams to find valid IDs for each field.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear workspace to use."),
        issueId: z.string().describe("The ID of the Linear issue to update. Use linear_search_ticket to find the issue ID."),
        updates: updateTicketInputSchema
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.LINEAR_UPDATE_TICKET),
    execute: async ({ integrationId, issueId, updates }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_update_ticket tool", { integrationId, issueId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user.organizationId
        const linearIntegration = await db().linear_integrations.findUnique({
            where: { id: integrationId, organization_id: organizationId }
        })
        if (!linearIntegration) {
            throw new Error(`Linear integration not found for integrationId: ${integrationId}`)
        }

        const manager = new LinearIntegrationManager()
        const accessToken = await manager.getAccessToken(linearIntegration.id)
        if (!accessToken) {
            throw new Error(`Linear integration not found or access denied for integrationId: ${integrationId}`)
        }

        const client = new LinearClient({ accessToken })

        const issueUpdates: IssueUpdateInput = {}

        if (updates.title) {
            issueUpdates.title = updates.title
        }
        if (updates.description) {
            issueUpdates.description = updates.description
        }
        if (updates.stateId) {
            issueUpdates.stateId = updates.stateId
        }
        if (updates.priority !== undefined && updates.priority !== null) {
            issueUpdates.priority = updates.priority
        }
        if (updates.projectId) {
            issueUpdates.projectId = updates.projectId
        }
        if (updates.labelIds) {
            issueUpdates.labelIds = updates.labelIds
        }
        if (updates.assigneeId) {
            issueUpdates.assigneeId = updates.assigneeId
        }

        try {
            const payload = await client.updateIssue(issueId, issueUpdates)

            const updatedIssue = await payload.issue
            if (!updatedIssue?.id) {
                throw new Error("Failed to update ticket")
            }

            const ticketData = await client.issue(updatedIssue.id)

            const action = {
                action: "Updated ticket",
                integration: IntegrationType.LINEAR,
                target: ticketData.identifier,
                details: `Updated ticket: ${ticketData.identifier}`,
                type: RunHistoryActionType.update,
                url: ticketData.url
            }
            return {
                success: true,
                issue: ticketData,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("❌ Error updating Linear ticket", { error: errorMessage, issueId })
            return {
                success: false,
                error: errorMessage,
                hint: "Please check all inputs and try again."
            }
        }
    },
    errorFunction: formatError
})
