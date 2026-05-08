import type { RunContext } from "@openai/agents"
import type { ACLRule } from "terse-types"
import { IntegrationType, hasACLRule, hasAnyACLRuleForIntegration } from "terse-types"

import { SessionWithTracking } from "../../agent/AgentRunner/BaseAgentRunner"
import { Session } from "../../express"
import { initializeSlackWebClient } from "../../integrations/SlackClient"
import logger from "../../logger"
import { db } from "../../prismaClient"
import type { ToolACLValidationResult } from "../abstract/Output"
import { ToolACLValidator, configIsWritableForIntegration, denyToolACL } from "../abstract/Output"

function hasSlackChannelACL(params: { aclRules: ACLRule[]; integrationId: string; channelId: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.SLACK,
        integrationId: params.integrationId,
        resourceType: "channel",
        resourceId: params.channelId
    })
}

function hasSlackDmUserACL(params: { aclRules: ACLRule[]; integrationId: string; userId: string }): boolean {
    return hasACLRule(params.aclRules, {
        integrationType: IntegrationType.SLACK,
        integrationId: params.integrationId,
        resourceType: "dm_user",
        resourceId: params.userId
    })
}

/**
 * Resolves a Slack `channelId` to its 1:1 IM counterparty user ID for ACL checks.
 *
 * Returns the user ID only when the channel is a 1:1 IM (`is_im && !is_mpim && user`).
 * Returns `null` for public/private channels, MPIMs, missing channels, missing integration
 * record, or any API error. Callers must treat `null` as deny.
 *
 * Intentionally uncached — ACL must be re-evaluated on every model-selected tool call.
 */
async function resolveSlackDmUserIdForChannel(params: { integrationId: string; organizationId: string; channelId: string }): Promise<string | null> {
    try {
        const userSlackIntegration = await db().user_slack_integrations.findFirst({
            where: { id: params.integrationId, organization_id: params.organizationId },
            include: { slack_integration: true, user: true }
        })
        if (!userSlackIntegration) return null

        const client = await initializeSlackWebClient(userSlackIntegration)
        const channelInfo = await client.conversations.info({ channel: params.channelId })
        const channel = channelInfo.channel as { is_im?: boolean; is_mpim?: boolean; user?: string } | undefined

        if (!channel?.is_im || channel.is_mpim || !channel.user) {
            return null
        }
        return channel.user
    } catch (error) {
        logger.warn("[Slack ACL] Failed to resolve channel info during ACL check", {
            integrationId: params.integrationId,
            channelId: params.channelId,
            error: error instanceof Error ? error.message : String(error)
        })
        return null
    }
}

async function validateSlackChannelScope(params: {
    args: { integrationId: string; channelId: string }
    aclRules: ACLRule[]
    runContext?: RunContext<SessionWithTracking<Session>>
}): Promise<ToolACLValidationResult> {
    if (hasSlackChannelACL({ aclRules: params.aclRules, integrationId: params.args.integrationId, channelId: params.args.channelId })) {
        return { ok: true }
    }

    const organizationId = params.runContext?.context?.user?.organizationId
    if (!organizationId) {
        return denyToolACL(`Slack ACL denied: channel ${params.args.channelId} is not configured for this run.`)
    }

    const dmUserId = await resolveSlackDmUserIdForChannel({
        integrationId: params.args.integrationId,
        organizationId,
        channelId: params.args.channelId
    })

    if (dmUserId && hasSlackDmUserACL({ aclRules: params.aclRules, integrationId: params.args.integrationId, userId: dmUserId })) {
        return { ok: true }
    }

    return denyToolACL(`Slack ACL denied: channel ${params.args.channelId} is not configured for this run.`)
}

export const validateSlackIntegrationACL: ToolACLValidator<{ integrationId: string }> = ({ args, aclRules, configs: _configs }) => {
    const allowed = hasAnyACLRuleForIntegration({
        rules: aclRules,
        integrationType: IntegrationType.SLACK,
        integrationId: args.integrationId
    })

    return allowed
        ? { ok: true }
        : denyToolACL(`Slack ACL denied: integration ${args.integrationId} is not configured for this run.`)
}

/** Read tools: channel or DM scope only. */
export const validateSlackReadChannelACL: ToolACLValidator<{ integrationId: string; channelId: string }> = params =>
    validateSlackChannelScope(params)

/** Send message: integration must be writable for this run, then channel/DM scope. */
export const validateSlackWriteChannelACL: ToolACLValidator<{ integrationId: string; channelId: string }> = async params => {
    if (
        !configIsWritableForIntegration({
            configs: params.configs,
            integrationId: params.args.integrationId
        })
    ) {
        return denyToolACL(`Slack ACL denied: integration ${params.args.integrationId} is read-only for this run.`)
    }
    return validateSlackChannelScope(params)
}
