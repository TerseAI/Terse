import { RunContext, tool } from "@openai/agents"
import { RunHistoryActionType } from "@prisma/client"
import { z } from "zod"

import { SessionWithTracking } from "../../../agent/AgentRunner/AgentRunner"
import { initializeSlackWebClient } from "../../../integrations/SlackClient"
import logger from "../../../logger"
import { db } from "../../../prismaClient"
import { IntegrationType } from "../../../shared/Integrations"
import { ToolName } from "../../../tools/ToolNames"
import { formatError } from "../../../tools/toolUtils"
import { Session } from "../../../types/session"

export const slackListChannelsTool = tool({
    name: ToolName.SLACK_LIST_CHANNELS,
    description: `List available Slack channels and conversations (public, private, DMs, multi-person DMs) that the integration can access.
Use this to discover channel IDs before reading conversation history.
Supports pagination: if the response includes nextCursor and hasMore, pass nextCursor as the cursor parameter on the next call to fetch more.`,
    parameters: z.object({
        integrationId: z.string().describe("The integration ID of the Slack workspace (user_slack_integrations id)."),
        types: z
            .enum(["public", "private", "im", "mpim", "all"])
            .nullable()
            .optional()
            .describe("Filter by type: public (public channels), private (private channels), im (DMs), mpim (group DMs), or all. Defaults to all."),
        limit: z.number().min(1).max(500).nullable().optional().default(100).describe("Maximum number of conversations to return."),
        cursor: z.string().nullable().optional().describe("Pagination cursor from a previous response (nextCursor). Omit on first call.")
    }),
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
                where: {
                    id: integrationId,
                    organization_id: organizationId
                },
                include: {
                    slack_integration: true,
                    user: true
                }
            })

            if (!userSlackIntegration) {
                return {
                    success: false,
                    error: `Slack integration not found or access denied: ${integrationId}`,
                    hint: "Ensure the integration ID is correct and belongs to your account."
                }
            }

            const client = initializeSlackWebClient(userSlackIntegration)

            const excludeArchived = true
            const typesParam = types === "all" ? undefined : types === "im" ? "im" : types === "mpim" ? "mpim" : types === "private" ? "private_channel" : "public_channel"

            const result = await client.conversations.list({
                limit: limit ?? undefined,
                exclude_archived: excludeArchived,
                ...(typesParam && { types: typesParam }),
                ...(cursor && { cursor })
            })

            const channels = (result.channels ?? []).map((ch: { id?: string; name?: string; is_channel?: boolean; is_im?: boolean; is_mpim?: boolean; is_private?: boolean }) => {
                let name = ch.name ?? ch.id ?? ""
                if (ch.is_channel && !ch.is_private && name && !name.startsWith("#")) {
                    name = `#${name}`
                }
                return {
                    id: ch.id,
                    name,
                    isPrivate: ch.is_private ?? false,
                    isIm: ch.is_im ?? false,
                    isMpim: ch.is_mpim ?? false
                }
            })

            const action = {
                action: "Listed channels",
                integration: IntegrationType.SLACK,
                target: userSlackIntegration.slack_integration.team_name ?? "Slack workspace",
                details: `Found ${channels.length} conversation(s)`,
                type: RunHistoryActionType.read
            }

            const nextCursor = (result as { response_metadata?: { next_cursor?: string } }).response_metadata?.next_cursor ?? null
            return {
                success: true,
                channels,
                count: channels.length,
                nextCursor,
                hasMore: !!nextCursor,
                actions: [action]
            }
        } catch (error: unknown) {
            const errorMessage = await formatError(runContext!, error)
            logger.error("❌ Error listing Slack channels", { error: errorMessage, integrationId })
            return {
                success: false,
                error: errorMessage,
                hint: "Check that the Slack integration is connected and has the required scopes (channels:read, groups:read, im:read, mpim:read)."
            }
        }
    },
    errorFunction: formatError
})
