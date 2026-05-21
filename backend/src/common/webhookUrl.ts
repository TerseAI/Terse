import { ApiRoutes, buildRoute } from "terse-types"

import { settings } from "../config/settings"

export function joinJobServerPath(jobBaseUrl: string, pathFromRoot: string): string {
    const relative = pathFromRoot.replace(/^\/+/, "")
    return new URL(relative, jobBaseUrl).href
}

export function buildWebhookUrl(webhookToken: string): string {
    const baseUrl = settings.urls.backendProxy ?? settings.urls.backend
    return `${baseUrl}${buildRoute(ApiRoutes.WEBHOOKS.WEBHOOK_TRIGGER_BY_TOKEN, { webhookToken })}`
}

export function buildHeyReachWebhookUrl(triggerId: string): string {
    const baseUrl = settings.urls.backendProxy ?? settings.urls.backend
    return `${baseUrl}/webhooks/heyreach/${triggerId}`
}

export function buildAttioWebhookUrl(triggerId: string): string {
    const baseUrl = settings.urls.backendProxy ?? settings.urls.backend
    return `${baseUrl}/webhooks/attio/${triggerId}`
}
