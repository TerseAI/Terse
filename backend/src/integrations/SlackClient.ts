import { LogLevel, WebClient } from "@slack/web-api"
import { IntegrationType } from "terse-types/Integrations"

import logger from "../logger"
import { SecretNotFoundError, getSecrets } from "../services/SecretService"

type SlackTokenSource = {
    id: string
    is_bot_user: boolean
    slack_integration: {
        id: string
    }
}

export async function resolveSlackAccessToken(integration: SlackTokenSource): Promise<string | null> {
    if (integration.is_bot_user) {
        try {
            const botSecrets = await getSecrets({
                type: "integration",
                secret: { integrationType: IntegrationType.SLACK, recordId: integration.slack_integration.id }
            })
            return botSecrets.accessToken ?? null
        } catch (error) {
            if (error instanceof SecretNotFoundError) {
                logger.error(`Slack integration ${integration.id} not found or missing access token`, { integrationId: integration.id })
                return null
            }
            throw error
        }
    }

    const userSecrets = await getSecrets({
        type: "integration",
        secret: { integrationType: IntegrationType.SLACK, recordId: integration.id }
    })
    if (userSecrets?.authedUserAccessToken) return userSecrets.authedUserAccessToken

    const fallbackSecrets = await getSecrets({
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
