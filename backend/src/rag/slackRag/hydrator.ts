import { Hydrator, Identifiable, HydrationContext } from "../Hydrator";
import { db } from "../../prismaClient";
import { HydratorType } from "../../types/rag";
import { SlackEvent, SlackEventData, initializeSlackWebClient } from "../../integrations/SlackIntegration";

// Parse Slack permalink: https://workspace.slack.com/archives/CHANNEL_ID/p1234567890123456
function parsePermalink(permalink: string): { channelId: string; timestamp: string } | null {
    const match = permalink.match(/\/archives\/([A-Z0-9]+)\/p(\d+)/);
    if (!match) return null;
    
    const channelId = match[1];
    // Convert permalink timestamp (no decimal) to Slack ts format (with decimal)
    const rawTs = match[2];
    const timestamp = `${rawTs.slice(0, -6)}.${rawTs.slice(-6)}`;
    
    return { channelId, timestamp };
}

export class SlackEventHydrator extends Hydrator<SlackEvent> {
    readonly entityType = HydratorType.SLACK_MESSAGE_EVENT;

    constructor(ctx: HydrationContext) {
        super(ctx);
    }

    async hydrate(ref: Identifiable): Promise<SlackEvent> {
        const event = await this.fetchFromSlack(ref.entityId);
        if (!event) {
            throw new Error(`Failed to hydrate Slack event: ${ref.entityId}`);
        }
        return event;
    }

    async hydrateBulk(refs: Identifiable[]): Promise<SlackEvent[]> {
        const results = await Promise.all(
            refs.map(ref => this.fetchFromSlack(ref.entityId))
        );
        
        return results.map((event, i) => {
            if (!event) {
                throw new Error(`Failed to hydrate Slack event: ${refs[i].entityId}`);
            }
            return event;
        });
    }

    private async fetchFromSlack(permalink: string): Promise<SlackEvent | null> {
        const parsed = parsePermalink(permalink);
        if (!parsed) {
            console.error(`Invalid Slack permalink: ${permalink}`);
            return null;
        }

        const { channelId, timestamp } = parsed;

        // Find the user's Slack integration
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: { user_id: this.ctx.userId },
            include: { 
                slack_integration: true,
                user: true
            }
        });

        if (!userSlackIntegration?.slack_integration) {
            console.error(`No Slack integration found for user: ${this.ctx.userId}`);
            return null;
        }

        const client = initializeSlackWebClient(userSlackIntegration as any);

        try {
            // Fetch the specific message
            const result = await client.conversations.history({
                channel: channelId,
                latest: timestamp,
                limit: 1,
                inclusive: true
            });

            const message = result.messages?.[0];
            if (!message) {
                console.error(`Message not found: ${permalink}`);
                return null;
            }

            // Get channel info
            const channelInfo = await client.conversations.info({ channel: channelId });
            const channelName = (channelInfo.channel as any)?.name;

            // Get user info
            let userName: string | undefined;
            if (message.user) {
                try {
                    const userInfo = await client.users.info({ user: message.user });
                    userName = (userInfo.user as any)?.real_name || (userInfo.user as any)?.name;
                } catch {
                    // User info fetch failed, continue without it
                }
            }

            const eventData: SlackEventData = {
                channelId,
                channelName,
                userId: message.user || '',
                userName,
                text: message.text || '',
                timestamp: message.ts || timestamp,
                threadTimestamp: message.thread_ts,
                teamId: userSlackIntegration.slack_integration.team_id,
                permalink
            };

            return new SlackEvent(eventData);
        } catch (error) {
            console.error(`Failed to fetch Slack message: ${permalink}`, error);
            return null;
        }
    }
}
