import { LinearClient } from "@linear/sdk"
import { IssueUpdateInput } from "@linear/sdk/dist/_generated_documents"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, LinearOutputConfig } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { getLinearAccessTokenForOrganization } from "../../../integrations/linear/integration"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator, denyToolACL, findConfigsByIntegrationId } from "../../abstract/acl"
import { verifyLinearIssueInScope } from "../linearAcl"

export const linearUpdateTicketTool = defineSessionTool({
    name: "linear_update_ticket",
    execute: async ({ integrationId, issueId, updates }, runContext) => {
        logger.debug("🛠️ Executing linear_update_ticket tool", { integrationId, issueId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

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
            logger.error("❌ Error updating Linear ticket", { error: errorMessage, issueId })
            throw new Error(`${errorMessage}. Please check all inputs and try again.`)
        }
    }
})

export const validateLinearUpdateTicket: ToolACLValidator<"linear_update_ticket", LinearOutputConfig> = async ({ args, configs, runContext }) => {
    const issueScopeCheck = await verifyLinearIssueInScope({ integrationId: args.integrationId, issueId: args.issueId, configs, runContext })
    if (!issueScopeCheck.ok) return issueScopeCheck

    // If the update would move the issue to a different project, that target project must also be configured
    if (args.updates.projectId) {
        const matching = findConfigsByIntegrationId(args.integrationId, configs)
        const narrowing = matching.filter(c => c.projectId)
        if (narrowing.length > 0 && !narrowing.some(c => c.projectId === args.updates.projectId)) {
            const allowed = narrowing.map(c => c.projectId).join(", ")
            return denyToolACL(`Linear update would move issue into projectId "${args.updates.projectId}", which is not in the configured projects: ${allowed}.`)
        }
    }
    return { ok: true }
}
