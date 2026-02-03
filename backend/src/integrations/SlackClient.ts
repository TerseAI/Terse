import { LogLevel, WebClient } from "@slack/web-api"

import { UserSlackIntegrationWithUser } from "../types/prisma"

/**
 * Initializes a Slack WebClient for a user's integration.
 * This is in a separate file to avoid circular dependencies with SlackIntegration.ts
 */
export function initializeSlackWebClient(integration: UserSlackIntegrationWithUser): WebClient {
    const token = integration.authed_user_access_token || integration.slack_integration.access_token
    return new WebClient(token, {
        logLevel: LogLevel.INFO
    })
}
