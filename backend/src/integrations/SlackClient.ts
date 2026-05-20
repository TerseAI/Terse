import { LogLevel, WebClient } from "@slack/web-api"
import { IntegrationType } from "terse-types/Integrations"

import { SecretService } from "../services/SecretService"

type SlackTokenSource = {
    id: string
    is_bot_user: boolean
    slack_integration: {
        id: string
    }
}

export async function resolveSlackAccessToken(integration: SlackTokenSource): Promise<string | null> {
    const secretService = SecretService.getInstance()
    if (integration.is_bot_user) {
        const botSecrets = await secretService.tryGetSecrets({
            type: "integration",
            secret: { integrationType: IntegrationType.SLACK, recordId: integration.slack_integration.id }
        })
        return botSecrets?.accessToken ?? null
    }

    const userSecrets = await secretService.tryGetSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.SLACK, recordId: integration.id }
    })
    if (userSecrets?.authedUserAccessToken) return userSecrets.authedUserAccessToken

    const fallbackSecrets = await secretService.tryGetSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.SLACK, recordId: integration.slack_integration.id }
    })
    return fallbackSecrets?.accessToken ?? null
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
