import { ApiRoutes } from "terse-types"
import { webhookJobTriggerResponseSchema } from "terse-types/types"

import { db } from "../prismaClient"
import { hashToken } from "../utility/apiTokens"
import { extractErrorMessage } from "../utility/strings"
import { validateRemoteServerUrl } from "../utility/urlValidation"
import { joinJobServerPath } from "../utility/webhookUrl"

/** Default timeout for handshake and delivery POSTs to a deployed SDK job URL. */
export const WEBHOOK_JOB_FETCH_TIMEOUT_MS = 30_000

export interface WebhookJobHandshakeChallengeParams {
    remoteServerUrl: string
    organizationId: string
    /**
     * When set, aborts the handshake fetch if this signal aborts (e.g. HTTP request cancelled).
     * The timeout still applies.
     */
    signal?: AbortSignal
}

/**
 * Outcome of the challenge POST (`{ challenge: true }` only) plus server-side verification that the
 * returned `apiKey` is a valid API token for `organizationId`. Use from webhook execution and
 * from a “test endpoint” action in the Web UI.
 */
export type WebhookJobHandshakeChallengeResult =
    | { ok: true; triggerUrl: string }
    | {
          ok: false
          triggerUrl: string
          step: "http" | "json" | "response_schema" | "token" | "org"
          message: string
          httpStatus?: number
      }

/**
 * POSTs `{ challenge: true }` to the job’s Terse trigger path, parses `{ apiKey }`, and verifies
 * the key exists and belongs to `organizationId`.
 */
export async function runWebhookJobHandshakeChallenge(params: WebhookJobHandshakeChallengeParams): Promise<WebhookJobHandshakeChallengeResult> {
    const timeoutMs = WEBHOOK_JOB_FETCH_TIMEOUT_MS

    try {
        await validateRemoteServerUrl(params.remoteServerUrl)
    } catch (error) {
        return {
            ok: false,
            triggerUrl: params.remoteServerUrl,
            step: "http",
            message: error instanceof Error ? error.message : "Invalid remote server URL"
        }
    }

    const triggerUrl = joinJobServerPath(params.remoteServerUrl, ApiRoutes.SDK.JOB_WEBHOOK_TRIGGER)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    if (params.signal) {
        if (params.signal.aborted) {
            controller.abort()
        } else {
            params.signal.addEventListener("abort", () => controller.abort(), { once: true })
        }
    }

    let response: Response
    try {
        response = await fetch(triggerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ challenge: true }),
            signal: controller.signal
        })
    } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError"
        return {
            ok: false,
            triggerUrl,
            step: "http",
            message: aborted ? "Webhook handshake request timed out" : extractErrorMessage(error)
        }
    } finally {
        clearTimeout(timeout)
    }

    if (!response.ok) {
        const body = await response.text().catch(() => "")
        const detail = body.slice(0, 500)
        return {
            ok: false,
            triggerUrl,
            step: "http",
            message: `Webhook handshake returned ${response.status}: ${detail}`,
            httpStatus: response.status
        }
    }

    let handshakeJson: unknown
    try {
        handshakeJson = await response.json()
    } catch {
        return {
            ok: false,
            triggerUrl,
            step: "json",
            message: "Webhook handshake returned invalid JSON response"
        }
    }

    const parsedHandshake = webhookJobTriggerResponseSchema.safeParse(handshakeJson)
    if (!parsedHandshake.success) {
        const details = parsedHandshake.error.issues.map(i => i.message).join("; ")
        return {
            ok: false,
            triggerUrl,
            step: "response_schema",
            message: `Webhook handshake response failed validation: ${details}`
        }
    }

    const tokenHash = hashToken(parsedHandshake.data.apiKey)
    const token = await db().api_tokens.findUnique({
        where: { token_hash: tokenHash }
    })

    if (!token) {
        return {
            ok: false,
            triggerUrl,
            step: "token",
            message: "Webhook handshake failed: invalid API key"
        }
    }

    if (token.organization_id !== params.organizationId) {
        return {
            ok: false,
            triggerUrl,
            step: "org",
            message: "Webhook handshake failed: API key does not belong to this organization"
        }
    }

    return { ok: true, triggerUrl }
}
