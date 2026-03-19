import { WebClient } from "@slack/web-api"

import { getACLOrNull, isPermitted } from "../../agent/acl/aclGuardrail"
import { getSlackAccessTokenOrThrow } from "../../integrations/SlackIntegration"
import { SlackOutputConfig } from "../../shared/Configs"
import { IntegrationType } from "../../shared/Integrations"
import { ACLCheckResult, ResourceType, createACLItem } from "../../shared/acl"
import { getStringArg } from "../../utility/args"

export async function checkConversationToolAccess(configs: SlackOutputConfig[], args: Record<string, unknown>): Promise<ACLCheckResult> {
    const integrationId = getStringArg(args, "integrationId")
    const channelId = getStringArg(args, "channelId")

    if (!integrationId || !channelId) {
        return { allowed: false, reason: "Slack tool calls must include integrationId and channelId." }
    }

    const allowed = getACLOrNull(configs, integrationId)
    if (!allowed) {
        return { allowed: false, reason: `Slack integration ${integrationId} is not configured for this agent.` }
    }

    const requestedChannel = createACLItem(IntegrationType.SLACK, ResourceType.CHANNEL, channelId)

    if (isPermitted(requestedChannel, allowed)) {
        return { allowed: true }
    }

    try {
        const token = await getSlackAccessTokenOrThrow(integrationId)
        const client = new WebClient(token)
        const result = await client.conversations.info({ channel: channelId })
        const channel = result.channel as { is_im?: boolean; is_mpim?: boolean; user?: string } | undefined

        if (channel?.is_im && channel.user) {
            const requestedUser = createACLItem(IntegrationType.SLACK, ResourceType.USER, channel.user)

            if (isPermitted(requestedUser, allowed)) {
                return { allowed: true }
            }

            return { allowed: false, reason: `Slack DM target ${channel.user} is outside the configured ACL for integration ${integrationId}.` }
        }

        if (channel?.is_mpim) {
            return { allowed: false, reason: `Slack group DM ${channelId} is not allowed unless it is explicitly channel-scoped in the config.` }
        }

        return { allowed: false, reason: `Slack channel ${channelId} is outside the configured ACL for integration ${integrationId}.` }
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        return { allowed: false, reason: `Unable to verify Slack ACL for channel ${channelId}: ${reason}` }
    }
}
