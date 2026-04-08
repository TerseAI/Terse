import { ApiRoutes, buildRoute } from "terse-types"

import { settings } from "../config/settings"

/**
 * Append a root-absolute path (e.g. `/webhook/...`) to `TERSE_JOB_URL` without duplicating slashes,
 * and resolve correctly when the job URL includes a path prefix.
 */
export function joinJobServerPath(jobBaseUrl: string, pathFromRoot: string): string {
    const relative = pathFromRoot.replace(/^\/+/, "")
    return new URL(relative, jobBaseUrl).href
}

export function buildWebhookUrl(webhookToken: string): string {
    const baseUrl = settings.urls.backendProxy ?? settings.urls.backend
    return `${baseUrl}${buildRoute(ApiRoutes.WEBHOOKS.WEBHOOK_TRIGGER_BY_TOKEN, { webhookToken })}`
}
