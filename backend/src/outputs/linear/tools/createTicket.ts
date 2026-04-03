import { LinearClient } from "@linear/sdk"
import { IssueCreateInput } from "@linear/sdk/dist/_generated_documents"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"

export const linearCreateTicketTool = defineSessionTool({
    name: "linear_create_ticket",
    description: "Create a new Linear issue/ticket.",
    execute: async ({ integrationId, ticket }, runContext) => {
        logger.debug("🛠️ Executing linear_create_ticket tool", { integrationId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

        const client = new LinearClient({ accessToken })

        try {
            const createTicketInput: IssueCreateInput = {
                title: ticket.title,
                teamId: ticket.teamId
            }

            if (ticket.description) createTicketInput.description = ticket.description
            if (ticket.stateId) createTicketInput.stateId = ticket.stateId
            if (ticket.projectId) createTicketInput.projectId = ticket.projectId
            if (ticket.labelIds) createTicketInput.labelIds = ticket.labelIds
            if (ticket.priority !== undefined && ticket.priority !== null) {
                createTicketInput.priority = ticket.priority
            }
            if (ticket.assigneeId) createTicketInput.assigneeId = ticket.assigneeId

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
                issue: {
                    id: ticketData.id,
                    identifier: ticketData.identifier,
                    title: ticketData.title,
                    description: ticketData.description ?? null,
                    url: ticketData.url,
                    createdAt: ticketData.createdAt,
                    updatedAt: ticketData.updatedAt
                },
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error creating Linear ticket", {
                error: errorMessage,
                integrationId
            })
            throw new Error(`${errorMessage}. Please check all inputs and try again.`)
        }
    }
})
