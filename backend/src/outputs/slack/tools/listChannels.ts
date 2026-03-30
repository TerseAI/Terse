import { RunContext } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { initializeSlackWebClient } from "../../../integrations/SlackClient"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { SessionToolOptions } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

const SLACK_TYPES_MAP: Record<string, string> = {
    public: "public_channel",
    private: "private_channel",
    im: "im",
    mpim: "mpim",
    all: "public_channel,private_channel,im,mpim"
}

function formatChannel(ch: { id?: string; name?: string; user?: string; is_channel?: boolean; is_im?: boolean; is_mpim?: boolean; is_private?: boolean }) {
    const isPublicChannel = ch.is_channel && !ch.is_private
    const rawName = ch.name ?? ch.id ?? ""
    const name = isPublicChannel && rawName && !rawName.startsWith("#") ? `#${rawName}` : rawName

    return {
        id: ch.id,
        name,
        isPrivate: ch.is_private ?? false,
        isIm: ch.is_im ?? false,
        isMpim: ch.is_mpim ?? false,
        userId: ch.is_im && ch.user ? ch.user : undefined
    }
}

const parameters = z.object({
    integrationId: z.string().describe("The integration ID of the Slack workspace (user_slack_integrations id)."),
    types: z
        .enum(["public", "private", "im", "mpim", "all"])
        .nullable()
        .optional()
        .describe("Filter by type: public (public channels), private (private channels), im (DMs), mpim (group DMs), or all. Defaults to all."),
    limit: z.number().min(1).max(500).nullable().optional().default(100).describe("Maximum number of conversations to return."),
    cursor: z.string().nullable().optional().describe("Pagination cursor from a previous response (nextCursor). Omit on first call.")
})

export const slackListChannelsTool: SessionToolOptions<typeof parameters, typeof ToolName.SLACK_LIST_CHANNELS> = {
    name: ToolName.SLACK_LIST_CHANNELS,
    description: `List available Slack channels and conversations (public, private, DMs, multi-person DMs) that the integration can access.
Use this to discover channel IDs before reading conversation history.
Supports pagination: if the response includes nextCursor and hasMore, pass nextCursor as the cursor parameter on the next call to fetch more.`,
    parameters: parameters,
    execute: async ({ integrationId, types = "all", limit = 100, cursor }, runContext?: RunContext<SessionWithTracking<Session>>) => {
        logger.debug("🛠️ Executing slack_list_channels tool", { integrationId, types, limit })

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
                include: { slack_integration: true, user: true }
            })

            if (!userSlackIntegration) {
                throw new Error(`Slack integration not found or access denied: ${integrationId}`)
            }

            const client = await initializeSlackWebClient(userSlackIntegration)

            const result = await client.conversations.list({
                types: SLACK_TYPES_MAP[types ?? "all"],
                exclude_archived: true,
                limit: limit ?? undefined,
                ...(cursor && { cursor })
            })

            const formatted = (result.channels ?? []).map(formatChannel)

            // Resolve user IDs to display names for IM channels
            const imChannels = formatted.filter(ch => ch.isIm && ch.userId)
            if (imChannels.length > 0) {
                const userIds = [...new Set(imChannels.map(ch => ch.userId!))]
                const userNames = new Map<string, string>()

                await Promise.all(
                    userIds.map(async userId => {
                        try {
                            const info = await client.users.info({ user: userId })
                            const name = info.user?.real_name || info.user?.name
                            if (name) userNames.set(userId, name)
                        } catch (e) {
                            logger.warn("Failed to resolve Slack user name", { userId, error: e })
                        }
                    })
                )

                for (const ch of imChannels) {
                    const name = userNames.get(ch.userId!)
                    if (name) {
                        ch.name = name
                    }
                }
            }

            const channels = formatted
            const nextCursor = (result as { response_metadata?: { next_cursor?: string } }).response_metadata?.next_cursor ?? null

            return {
                success: true,
                channels,
                count: channels.length,
                nextCursor,
                hasMore: !!nextCursor,
                actions: [
                    {
                        action: "Listed channels",
                        integration: IntegrationType.SLACK,
                        target: userSlackIntegration.slack_integration.team_name ?? "Slack workspace",
                        details: `Found ${channels.length} conversation(s)`,
                        type: RunHistoryActionType.read
                    }
                ]
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error("❌ Error listing Slack channels", { error: errorMessage, integrationId })
            throw new Error(`${errorMessage}. Check that the Slack integration is connected and has the required scopes (channels:read, groups:read, im:read, mpim:read).`)
        }
    }
}
