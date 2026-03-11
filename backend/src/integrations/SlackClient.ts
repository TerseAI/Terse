import { LogLevel, WebClient } from "@slack/web-api"

import { SecretField, SecretTable, getSecret } from "../services/SecretService"

type SlackTokenSource = {
    id: string
    slack_integration: {
        id: string
    }
}

/**
 * Initializes a Slack WebClient for a user's integration.
 * This is in a separate file to avoid circular dependencies with SlackIntegration.ts
 */
export async function resolveSlackAccessToken(integration: SlackTokenSource): Promise<string | null> {
    const userToken = await getSecret(SecretTable.UserSlackIntegrations, integration.id, SecretField.AuthedUserAccessToken)
    if (userToken) {
        return userToken
    }

    return await getSecret(SecretTable.SlackIntegrations, integration.slack_integration.id, SecretField.AccessToken)
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
