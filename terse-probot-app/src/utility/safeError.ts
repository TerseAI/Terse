import { AxiosError, isAxiosError } from "axios"

const SENSITIVE_HEADERS = ["authorization", "cookie", "set-cookie", "x-github-token", "x-hub-signature", "x-hub-signature-256"]

function stripSensitiveHeaders(headers: unknown): Record<string, unknown> | undefined {
    if (!headers || typeof headers !== "object") return undefined
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
        if (SENSITIVE_HEADERS.includes(key.toLowerCase())) continue
        out[key] = value
    }
    return out
}

// Mutates the AxiosError in place so any downstream raw-error logger
// (console.error, util.inspect, JSON.stringify) cannot leak the bearer token.
// AxiosError stores `config` as an own enumerable property, which is what
// makes the original raw-logging pattern leak `Authorization: Bearer ...`.
export function redactAxiosError(error: unknown): unknown {
    if (!isAxiosError(error)) return error
    const e = error as AxiosError
    if (e.config?.headers) {
        e.config.headers = stripSensitiveHeaders(e.config.headers) as never
    }
    if (e.response?.config?.headers) {
        e.response.config.headers = stripSensitiveHeaders(e.response.config.headers) as never
    }
    if (e.request?.getHeaders) {
        try {
            e.request.getHeaders = () => stripSensitiveHeaders(e.request.getHeaders())
        } catch {
            // Ignore — getHeaders may not be writable on all transports.
        }
    }
    return e
}

// Extracts a small, whitelisted set of fields safe to log from any error
// (Error, AxiosError, plain object, string). Never includes headers or
// request/response bodies, both of which can carry credentials.
export function safeErrorFields(error: unknown): Record<string, unknown> {
    if (error == null) return { message: String(error) }
    if (typeof error === "string") return { message: error }
    if (isAxiosError(error)) {
        return {
            message: error.message,
            code: error.code,
            status: error.response?.status,
            method: error.config?.method,
            url: error.config?.url
        }
    }
    if (error instanceof Error) {
        return { message: error.message, name: error.name }
    }
    return { message: String(error) }
}
