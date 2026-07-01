import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType, SlackOutputConfig } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { initializeSlackWebClient } from "../../../integrations/slack/client"
import { db } from "../../../loaders/prisma"
import { defineSessionTool } from "../../../tools/toolUtils"
import { ToolACLValidator } from "../../abstract/acl"

import { validateSlackChannelOrUser } from "./sendMessage"

export const slackToggleReactionTool = defineSessionTool({
    name: "slack_toggle_reaction",
    description: `Add or remove an emoji reaction on a Slack message. Use this to acknowledge a triggering message (e.g. add "eyes" while working) and clear it when done (e.g. remove "eyes" and add "white_check_mark"). Provide channelId and the message timestamp from the trigger event or slack_read_conversation.`,
    execute: async ({ integrationId, channelId, timestamp, emoji, action }, runContext) => {
        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user?.organizationId
        if (!organizationId) {
            throw new Error("Organization context required")
        }

        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: { id: integrationId, organization_id: organizationId },
            include: { slack_integration: true }
        })

        if (!userSlackIntegration) {
            throw new Error(`Slack integration not found or access denied: ${integrationId}. Ensure the integration ID is correct and belongs to your account.`)
        }

        const client = await initializeSlackWebClient(userSlackIntegration)
        const name = emoji.replace(/:/g, "")

        try {
            switch (action) {
                case "add":
                    await client.reactions.add({ channel: channelId, timestamp, name })
                    break
                case "remove":
                    await client.reactions.remove({ channel: channelId, timestamp, name })
                    break
                default:
                    throw action satisfies never
            }
        } catch (error: unknown) {
            if (!isIdempotentReactionError(error, action)) {
                const errorMessage = extractErrorMessage(error)
                logger.error("❌ Error toggling Slack reaction", { error: errorMessage, integrationId, channelId, timestamp, action })
                throw new Error(`${errorMessage}. Ensure the integration has the reactions:write scope and that channelId + timestamp point to an existing message.`)
            }
        }

        const { verb, type } = describeReactionAction(action)
        const actionRecord = {
            action: `${verb} Slack reaction`,
            integration: IntegrationType.SLACK,
            target: channelId,
            details: `:${name}: on message ${timestamp}`,
            type
        }

        return {
            success: true,
            channel: channelId,
            timestamp,
            emoji: name,
            action,
            summary: `${verb} :${name}: reaction on message ${timestamp} in ${channelId}`,
            actions: [actionRecord]
        }
    }
})

export const validateSlackToggleReaction: ToolACLValidator<"slack_toggle_reaction", SlackOutputConfig> = ({ args, configs }) =>
    validateSlackChannelOrUser(args.integrationId, args.channelId, null, configs)

function describeReactionAction(action: "add" | "remove"): { verb: string; type: RunHistoryActionType } {
    switch (action) {
        case "add":
            return { verb: "Added", type: RunHistoryActionType.create }
        case "remove":
            return { verb: "Removed", type: RunHistoryActionType.delete }
        default:
            throw action satisfies never
    }
}

function isIdempotentReactionError(error: unknown, action: "add" | "remove"): boolean {
    const code = (error as { data?: { error?: string } })?.data?.error
    switch (action) {
        case "add":
            return code === "already_reacted"
        case "remove":
            return code === "no_reaction"
        default:
            throw action satisfies never
    }
}
