import { ApiRoutes, buildRoute } from "terse-types"

import { settings } from "../config/settings"

export function buildWebhookUrl(webhookToken: string): string {
    const baseUrl = settings.urls.backendProxy ?? settings.urls.backend
    return `${baseUrl}${buildRoute(ApiRoutes.WEBHOOKS.WEBHOOK_TRIGGER_BY_TOKEN, { webhookToken })}`
}
