import { LinearClient } from "@linear/sdk"
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

export const linearAddCommentTool = tool({
    name: ToolName.LINEAR_ADD_COMMENT,
    description: `Add a comment to an existing Linear issue. Use linear_search_ticket to find the issue ID.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Linear workspace to use."),
        issueId: z.string().describe("The ID of the Linear issue to add the comment to. Use linear_search_ticket to find the issue ID."),
        body: z.string().describe("The comment text to add to the issue.")
    }),
    needsApproval: createNeedsApprovalFunction(ToolName.LINEAR_ADD_COMMENT),
    execute: async ({ integrationId, issueId, body }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing linear_add_comment tool", { integrationId, issueId })

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
            const payload = await client.createComment({
                issueId,
                body
            })

            const comment = await payload.comment
            if (!comment?.id) {
                throw new Error("Failed to add comment")
            }

            const ticketData = await client.issue(issueId)

            const action = {
                action: "Added comment",
                integration: IntegrationType.LINEAR,
                target: ticketData.identifier,
                details: `Comment added to ${ticketData.identifier}`,
                type: RunHistoryActionType.create,
                url: ticketData.url
            }
            return {
                success: true,
                comment,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext, error)
            logger.error("❌ Error adding Linear comment", { error: errorMessage, issueId })
            return {
                success: false,
                error: errorMessage,
                hint: "Please check all inputs and try again."
            }
        }
    },
    errorFunction: formatError
})
