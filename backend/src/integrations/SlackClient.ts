import { LogLevel, WebClient } from "@slack/web-api"

import { getSecret } from "../services/SecretService"

type SlackTokenSource = {
    id: string
    authed_user_access_token: string | null
    slack_integration: {
        id: string
        access_token: string
    }
}

/**
 * Initializes a Slack WebClient for a user's integration.
 * This is in a separate file to avoid circular dependencies with SlackIntegration.ts
 */
export async function resolveSlackAccessToken(integration: SlackTokenSource): Promise<string | null> {
    const userToken = integration.authed_user_access_token
        ? await getSecret("user_slack_integrations", integration.id, "authed_user_access_token", integration.authed_user_access_token)
        : null
    if (userToken) {
        return userToken
    }

    return await getSecret("slack_integrations", integration.slack_integration.id, "access_token", integration.slack_integration.access_token)
}

export async function initializeSlackWebClient(integration: SlackTokenSource): Promise<WebClient> {
    const token = await resolveSlackAccessToken(integration)
    if (!token) {
        throw new Error(`Slack token not found for integration ${integration.id}`)
    }

    return new WebClient(token, {
        logLevel: LogLevel.INFO
    })
}
