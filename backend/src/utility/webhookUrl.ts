import { ApiRoutes, buildRoute } from "terse-types"

import { settings } from "../config/settings"

/**
 * Append a root-absolute path (e.g. `/webhook/...`) to the remote server URL without duplicating slashes,
 * and resolve correctly when the job URL includes a path prefix.
 *
 * pathFromRoot MUST be a root-absolute path (starts with `/`). Anything that
 * parses as an absolute URL — `https://…`, `//…`, schemes with `://` — is
 * rejected: `new URL(absolute, base)` returns `absolute` verbatim, which
 * would silently hijack the base if pathFromRoot were ever attacker-influenced.
 */
export function joinJobServerPath(jobBaseUrl: string, pathFromRoot: string): string {
    if (pathFromRoot.startsWith("//") || pathFromRoot.includes("://")) {
        throw new Error(`joinJobServerPath: pathFromRoot must be a root-absolute path (got ${JSON.stringify(pathFromRoot)})`)
    }
    const relative = pathFromRoot.replace(/^\/+/, "")
    return new URL(relative, jobBaseUrl).href
}

export function buildWebhookUrl(webhookToken: string): string {
    const baseUrl = settings.urls.backendProxy ?? settings.urls.backend
    return `${baseUrl}${buildRoute(ApiRoutes.WEBHOOKS.WEBHOOK_TRIGGER_BY_TOKEN, { webhookToken })}`
}

/** HeyReach registers one webhook URL per agent trigger (`automation_inputs.id`), not per integration. */
export function buildHeyReachWebhookUrl(triggerId: string): string {
    const baseUrl = settings.urls.backendProxy ?? settings.urls.backend
    return `${baseUrl}/webhooks/heyreach/${triggerId}`
}

export function buildAttioWebhookUrl(triggerId: string): string {
    const baseUrl = settings.urls.backendProxy ?? settings.urls.backend
    return `${baseUrl}/webhooks/attio/${triggerId}`
}
