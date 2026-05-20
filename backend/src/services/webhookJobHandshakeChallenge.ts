import { ApiRoutes } from "terse-types"
import { webhookJobChallengeResponseSchema } from "terse-types/types"

import { safeFetch } from "../utility/safeFetch"
import { extractErrorMessage } from "../utility/strings"
import { ValidatedRemoteUrl, validateRemoteServerUrl } from "../utility/urlValidation"
import { buildSignatureHeaders, generateChallengeToken, verifyChallengeSignature } from "../utility/webhookHmac"
import { joinJobServerPath } from "../utility/webhookUrl"

export const WEBHOOK_JOB_FETCH_TIMEOUT_MS = 30_000
const WEBHOOK_JOB_MAX_BODY_BYTES = 64 * 1024

export interface WebhookJobHandshakeChallengeParams {
    remoteServerUrl: string
    signingSecret: string
    signal?: AbortSignal
}

export type WebhookJobHandshakeChallengeResult =
    | {
          ok: true
          triggerUrl: string
          validatedTrigger: ValidatedRemoteUrl
      }
    | {
          ok: false
          triggerUrl: string
          step: "http" | "json" | "response_schema" | "challenge_echo" | "challenge_signature"
          message: string
          httpStatus?: number
      }

export async function runWebhookJobHandshakeChallenge(params: WebhookJobHandshakeChallengeParams): Promise<WebhookJobHandshakeChallengeResult> {
    const timeoutMs = WEBHOOK_JOB_FETCH_TIMEOUT_MS

    let validated: ValidatedRemoteUrl
    try {
        validated = await validateRemoteServerUrl(params.remoteServerUrl)
    } catch (error) {
        return {
            ok: false,
            triggerUrl: params.remoteServerUrl,
            step: "http",
            message: error instanceof Error ? error.message : "Invalid remote server URL"
        }
    }

    const triggerUrl = joinJobServerPath(params.remoteServerUrl, ApiRoutes.SDK.JOB_WEBHOOK_TRIGGER)
    const validatedTrigger: ValidatedRemoteUrl = { ...validated, url: triggerUrl, parsedUrl: new URL(triggerUrl) }
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
        response = await safeFetch(validatedTrigger, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...buildSignatureHeaders(params.signingSecret, body)
            },
            body,
            signal: controller.signal
        })
    } catch (error) {
        clearTimeout(timeout)
        const aborted = error instanceof Error && error.name === "AbortError"
        return {
            ok: false,
            triggerUrl,
            step: "http",
            message: aborted ? "Webhook handshake request timed out" : extractErrorMessage(error)
        }
    }

    if (response.status >= 300 && response.status < 400) {
        clearTimeout(timeout)
        return {
            ok: false,
            triggerUrl,
            step: "http",
            message: `Server responded with HTTP ${response.status}. Redirects are not followed; the job server must respond to the handshake directly.`,
            httpStatus: response.status
        }
    }

    if (!response.ok) {
        clearTimeout(timeout)
        return {
            ok: false,
            triggerUrl,
            step: "http",
            message: `Server responded with HTTP ${response.status} (${response.statusText || "error"}).`,
            httpStatus: response.status
        }
    }

    let bodyText: string
    try {
        bodyText = await readResponseBodyWithCap(response, WEBHOOK_JOB_MAX_BODY_BYTES)
    } catch (error) {
        const aborted = error instanceof Error && error.name === "AbortError"
        return {
            ok: false,
            triggerUrl,
            step: "json",
            message: aborted ? "Webhook handshake body read timed out" : "Webhook handshake body exceeded size limit"
        }
    } finally {
        clearTimeout(timeout)
    }

    let handshakeJson: unknown
    try {
        handshakeJson = JSON.parse(bodyText)
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

    return { ok: true, triggerUrl, validatedTrigger }
}

async function readResponseBodyWithCap(response: Response, maxBytes: number): Promise<string> {
    if (!response.body) {
        return await response.text()
    }
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let received = 0
    let out = ""
    try {
        while (true) {
            const { value, done } = await reader.read()
            if (done) break
            received += value.byteLength
            if (received > maxBytes) {
                throw new Error(`response body exceeded ${maxBytes} bytes`)
            }
            out += decoder.decode(value, { stream: true })
        }
        out += decoder.decode()
        return out
    } finally {
        await reader.cancel().catch(() => undefined)
    }
}
