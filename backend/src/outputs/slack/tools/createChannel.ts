import { RunHistoryActionType } from "@prisma/client"
import { IntegrationType } from "terse-types"

import logger from "../../../common/logger"
import { extractErrorMessage } from "../../../common/strings"
import { initializeSlackWebClient } from "../../../integrations/slack/client"
import { db } from "../../../loaders/prisma"
import { defineSessionTool } from "../../../tools/toolUtils"
import { unrestricted } from "../../abstract/acl"

export const slackCreateChannelTool = defineSessionTool({
    name: "slack_create_channel",
    execute: async ({ integrationId, name, isPrivate = false, userIds }, runContext) => {
        logger.debug("🛠️ Executing slack_create_channel tool", { integrationId, name, isPrivate, userCount: userIds?.length ?? 0 })

        if (!runContext?.context) {
            throw new Error("No context provided")
        }

        const organizationId = runContext.context.user?.organizationId
        if (!organizationId) {
            throw new Error("Organization context required")
        }

        try {
            const userSlackIntegration = await db().user_slack_integrations.findFirst({
                where: { id: integrationId, organization_id: organizationId },
                include: { slack_integration: true }
            })

            if (!userSlackIntegration) {
                throw new Error(`Slack integration not found or access denied: ${integrationId}`)
            }

            const client = await initializeSlackWebClient(userSlackIntegration)

            const createResult = await client.conversations.create({
                name,
                is_private: isPrivate ?? false
            })

            if (!createResult.ok || !createResult.channel?.id) {
                throw new Error(`Failed to create channel: ${createResult.error ?? "unknown error"}`)
            }

            const channelId = createResult.channel.id
            const channelName = createResult.channel.name ? `#${createResult.channel.name}` : channelId

            // Invite the requested members, if any. Slack accepts a batch invite, but a single bad
            // member ID fails the whole call — so on failure we retry per-user to gather partial results.
            const requestedUserIds = [...new Set((userIds ?? []).filter(id => id.trim().length > 0))]
            const invitedUserIds: string[] = []
            const failedInvites: { userId: string; error: string }[] = []

            if (requestedUserIds.length > 0) {
                try {
                    await client.conversations.invite({ channel: channelId, users: requestedUserIds.join(",") })
                    invitedUserIds.push(...requestedUserIds)
                } catch (batchError) {
                    logger.warn("Batch invite to Slack channel failed, retrying per-user", {
                        channelId,
                        error: extractErrorMessage(batchError)
                    })
                    for (const userId of requestedUserIds) {
                        try {
                            await client.conversations.invite({ channel: channelId, users: userId })
                            invitedUserIds.push(userId)
                        } catch (inviteError) {
                            const inviteErrorMessage = (inviteError as { data?: { error?: string } })?.data?.error ?? extractErrorMessage(inviteError)
                            failedInvites.push({ userId, error: inviteErrorMessage })
                            logger.warn("Failed to invite user to Slack channel", { channelId, userId, error: inviteErrorMessage })
                        }
                    }
                }
            }

            const inviteSummary =
                requestedUserIds.length > 0 ? ` and invited ${invitedUserIds.length}/${requestedUserIds.length} member(s)${failedInvites.length > 0 ? ` (${failedInvites.length} failed)` : ""}` : ""

            const action = {
                action: "Created Slack channel",
                integration: IntegrationType.SLACK,
                target: channelName,
                details: `Created ${isPrivate ? "private" : "public"} channel ${channelName}${inviteSummary}`,
                type: RunHistoryActionType.create
            }

            return {
                success: true,
                channelId,
                channelName,
                isPrivate: (createResult.channel.is_private ?? isPrivate) === true,
                invitedUserIds,
                ...(failedInvites.length > 0 ? { failedInvites } : {}),
                actions: [action]
            }
        } catch (error: unknown) {
            const code = (error as { data?: { error?: string } })?.data?.error
            const errorMessage = extractErrorMessage(error)
            let hint =
                "Check that the integration has the required scopes (channels:manage for public channels, groups:write for private channels, and channels:write.invites/groups:write.invites to invite members)."
            if (code === "name_taken") {
                hint = "A channel with this name already exists. Choose a different name or use the existing channel."
            } else if (code === "invalid_name" || code === "invalid_name_specials" || code === "invalid_name_maxlength" || code === "invalid_name_required") {
                hint = "Invalid channel name. Use lowercase letters, numbers, hyphens and underscores only (no spaces or periods), max 80 characters."
            } else if (code === "restricted_action") {
                hint = "Workspace settings restrict channel creation for this account."
            }
            logger.error("❌ Error creating Slack channel", { error: errorMessage, integrationId, name })
            throw new Error(`${errorMessage}. ${hint}`)
        }
    }
})

export const validateSlackCreateChannel = unrestricted
