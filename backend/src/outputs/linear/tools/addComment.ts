import { LinearClient } from "@linear/sdk"
import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, LinearOutputConfig } from "terse-types"

import { getLinearAccessTokenForOrganization } from "../../../integrations/LinearIntegration"
import logger from "../../../logger"
import { defineSessionTool } from "../../../tools/toolUtils"
import { extractErrorMessage } from "../../../utility/strings"
import { ToolACLValidator, verifyIntegrationIdExists } from "../../abstract/Output"

export const linearAddCommentTool = defineSessionTool({
    name: "linear_add_comment",
    description: `Add a comment to an existing Linear issue. Use linear_search_ticket to find the issue ID.`,
    execute: async ({ integrationId, issueId, body }, runContext) => {
        logger.debug("🛠️ Executing linear_add_comment tool", { integrationId, issueId })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }
        const accessToken = await getLinearAccessTokenForOrganization(integrationId, runContext.context.user.organizationId)

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
                comment: {
                    id: comment.id,
                    body: comment.body,
                    createdAt: comment.createdAt,
                    updatedAt: comment.updatedAt
                },
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = extractErrorMessage(error)
            logger.error("❌ Error adding Linear comment", { error: errorMessage, issueId })
            throw new Error(`${errorMessage}. Please check all inputs and try again.`)
        }
    }
})

export const validateLinearAddComment: ToolACLValidator<"linear_add_comment", LinearOutputConfig> = ({ args, configs }) => verifyIntegrationIdExists(args.integrationId, configs)
