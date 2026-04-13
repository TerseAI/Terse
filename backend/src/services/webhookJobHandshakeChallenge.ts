import { ApiRoutes } from "terse-types"
import { webhookJobChallengeResponseSchema } from "terse-types/types"

import { extractErrorMessage } from "../utility/strings"
import { validateRemoteServerUrl } from "../utility/urlValidation"
import { buildSignatureHeaders, generateChallengeToken, verifyChallengeSignature } from "../utility/webhookHmac"
import { joinJobServerPath } from "../utility/webhookUrl"

export const WEBHOOK_JOB_FETCH_TIMEOUT_MS = 30_000

export interface WebhookJobHandshakeChallengeParams {
    remoteServerUrl: string
    signingSecret: string
    /**
     * When set, aborts the handshake fetch if this signal aborts (e.g. HTTP request cancelled).
     * The timeout still applies.
     */
    signal?: AbortSignal
}

/**
 * Outcome of the challenge POST plus server-side verification that the returned signature
 * proves the remote server holds the correct signing secret.
 */
export type WebhookJobHandshakeChallengeResult =
    | { ok: true; triggerUrl: string }
    | {
          ok: false
          triggerUrl: string
          step: "http" | "json" | "response_schema" | "challenge_echo" | "challenge_signature"
          message: string
          httpStatus?: number
      }

/**
 * POSTs `{ type: "challenge", challenge: "<random>" }` (signed) to the job's Terse trigger path,
 * then verifies the server echoed the challenge and provided a valid HMAC signature proving it
 * holds the signing secret.
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
    const challengeToken = generateChallengeToken()
    const body = JSON.stringify({ type: "challenge", challenge: challengeToken })

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
            headers: {
                "Content-Type": "application/json",
                ...buildSignatureHeaders(params.signingSecret, body)
            },
            body,
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
        const responseBody = await response.text().catch(() => "")
        const detail = responseBody.slice(0, 500)
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

    const parsed = webhookJobChallengeResponseSchema.safeParse(handshakeJson)
    if (!parsed.success) {
        const details = parsed.error.issues.map(i => i.message).join("; ")
        return {
            ok: false,
            triggerUrl,
            step: "response_schema",
            message: `Webhook handshake response failed validation: ${details}`
        }
    }

    if (parsed.data.challenge !== challengeToken) {
        return {
            ok: false,
            triggerUrl,
            step: "challenge_echo",
            message: "Webhook handshake failed: server did not echo the challenge token correctly"
        }
    }

    if (!verifyChallengeSignature(params.signingSecret, challengeToken, parsed.data.signature)) {
        return {
            ok: false,
            triggerUrl,
            step: "challenge_signature",
            message: "Webhook handshake failed: invalid challenge signature (signing secret mismatch)"
        }
    }

    return { ok: true, triggerUrl }
}
