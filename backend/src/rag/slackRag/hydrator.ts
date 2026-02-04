import { initializeSlackWebClient } from "../../integrations/SlackClient"
import { SlackEvent, SlackEventData } from "../../integrations/SlackIntegration"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { HydratorType } from "../../types/rag"
import { HydrationContext, Hydrator, Identifiable } from "../Hydrator"

// Parse Slack permalink: https://workspace.slack.com/archives/CHANNEL_ID/p1234567890123456
function parsePermalink(permalink: string): { channelId: string; timestamp: string } | null {
    const match = permalink.match(/\/archives\/([A-Z0-9]+)\/p(\d+)/)
    if (!match) return null

    const channelId = match[1]
    // Convert permalink timestamp (no decimal) to Slack ts format (with decimal)
    const rawTs = match[2]
    const timestamp = `${rawTs.slice(0, -6)}.${rawTs.slice(-6)}`

    return { channelId, timestamp }
}

export class SlackEventHydrator extends Hydrator<SlackEvent> {
    readonly entityType = HydratorType.SLACK_MESSAGE_EVENT

    constructor(ctx: HydrationContext) {
        super(ctx)
    }

    async hydrate(ref: Identifiable): Promise<SlackEvent> {
        const event = await this.fetchFromSlack(ref.entityId)
        if (!event) {
            throw new Error(`Failed to hydrate Slack event: ${ref.entityId}`)
        }
        return event
    }

    async hydrateBulk(refs: Identifiable[]): Promise<SlackEvent[]> {
        const results = await Promise.all(refs.map(ref => this.fetchFromSlack(ref.entityId)))

        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate Slack event: ${refs[i].entityId}`)
            }
            return event
        })
    }

    private async fetchFromSlack(permalink: string): Promise<SlackEvent | null> {
        const parsed = parsePermalink(permalink)
        if (!parsed) {
            logger.error(`Invalid Slack permalink: ${permalink}`)
            return null
        }

        const { channelId, timestamp } = parsed

        // Find all Slack integrations for the user and prefer user token (is_bot_user = false) as it's more permissive
        const userSlackIntegrations = await db().user_slack_integrations.findMany({
            where: { user_id: this.ctx.userId },
            include: {
                slack_integration: true,
                user: true
            }
        })

        if (userSlackIntegrations.length === 0) {
            logger.error(`No Slack integration found for user: ${this.ctx.userId}`)
            return null
        }

        // Prefer user token (is_bot_user = false) as it's more permissive, fall back to bot token if needed
        const userSlackIntegration = userSlackIntegrations.find(usi => usi.is_bot_user === false) || userSlackIntegrations[0]

        if (!userSlackIntegration?.slack_integration) {
            logger.error(`No valid Slack integration found for user: ${this.ctx.userId}`)
            return null
        }

        const client = initializeSlackWebClient(userSlackIntegration)

        try {
            // Fetch the specific message
            const result = await client.conversations.history({
                channel: channelId,
                latest: timestamp,
                limit: 1,
                inclusive: true
            })

            const message = result.messages?.[0]
            if (!message) {
                logger.error(`Message not found: ${permalink}`)
                return null
            }

            // Get channel info
            let channelName: string | undefined
            try {
                const channelInfo = await client.conversations.info({ channel: channelId })
                channelName = (channelInfo.channel as any)?.name
            } catch (channelError: any) {
                // Handle channel not found or access denied errors
                // These are expected for DMs (IM/MPIM) or private channels the token can't access
                const errorCode = channelError?.data?.error || channelError?.code
                if (errorCode === "channel_not_found" || errorCode === "not_in_channel" || errorCode === "missing_scope") {
                    logger.warn(`Could not fetch channel info for channelId: ${channelId} (${errorCode}). Continuing without channel name.`)
                } else {
                    logger.warn(`Failed to fetch channel info for channelId: ${channelId}. Continuing without channel name.`, channelError)
                }
            }

            // Get user info
            let userName: string | undefined
            if (message.user) {
                try {
                    const userInfo = await client.users.info({ user: message.user })
                    userName = (userInfo.user as any)?.real_name || (userInfo.user as any)?.name
                } catch {
                    // User info fetch failed, continue without it
                }
            }

            const eventData: SlackEventData = {
                channelId,
                channelName,
                userId: message.user || "",
                userName,
                text: message.text || "",
                timestamp: message.ts || timestamp,
                threadTimestamp: message.thread_ts,
                teamId: userSlackIntegration.slack_integration.team_id,
                permalink
            }

            return new SlackEvent(eventData)
        } catch (error: any) {
            // Handle specific Slack API errors
            const errorCode = error?.data?.error || error?.code
            const errorMessage = error?.data?.error || error?.message || "Unknown error"

            if (errorCode === "channel_not_found") {
                logger.error(`Channel not found: ${channelId} (permalink: ${permalink})`)
            } else if (errorCode === "not_in_channel") {
                logger.error(`Not in channel: ${channelId} (permalink: ${permalink}). User may not have access to this channel.`)
            } else if (errorCode === "missing_scope") {
                logger.error(`Missing scope for channel: ${channelId} (permalink: ${permalink}). Required scopes may not be granted.`)
            } else {
                logger.error(`Failed to fetch Slack message: ${permalink}`, error)
            }
            return null
        }
    }
}
