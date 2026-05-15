import { LogLevel, WebClient } from "@slack/web-api"
import { IntegrationType } from "terse-types/Integrations"

import { SecretField, getSecret } from "../services/SecretService"

type SlackTokenSource = {
    id: string
    is_bot_user: boolean
    slack_integration: {
        id: string
    }
}

/**
 * Initializes a Slack WebClient for a user's integration.
 * This is in a separate file to avoid circular dependencies with SlackIntegration.ts
 */
export async function resolveSlackAccessToken(integration: SlackTokenSource): Promise<string | null> {
    if (integration.is_bot_user) {
        return await getSecret({ type: "integration", params: { integrationType: IntegrationType.SLACK, recordId: integration.slack_integration.id, field: SecretField.AccessToken } })
    }

    const userToken = await getSecret({ type: "integration", params: { integrationType: IntegrationType.SLACK, recordId: integration.id, field: SecretField.AuthedUserAccessToken } })
    if (userToken) {
        return userToken
    }

    return await getSecret({ type: "integration", params: { integrationType: IntegrationType.SLACK, recordId: integration.slack_integration.id, field: SecretField.AccessToken } })
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
