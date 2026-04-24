import chalk from "chalk"
import dotenv from "dotenv"
import fs from "node:fs"
import path from "node:path"
import { ApiRoutes, buildRoute, sdkRunTriggerEventResponseSchema } from "terse-types"
import type { AgentsResponse, GetRunHistoryParams, GetRunHistoryResponse, RunHistoryModelEvent, SdkRunTriggerEventResponse, SerializedEvent } from "terse-types"

import { CliError, ErrorCode } from "./cliError.js"
import { BACKEND_URL } from "./config.js"
import { getStoredApiKey } from "./userConfig.js"

/** Thrown by `fetchWithAuth` on any non-2xx. Exposes `status` and the parsed body so callers can branch on specific failures. */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        readonly body: Record<string, unknown>
    ) {
        super(`HTTP ${status} — ${body.error || JSON.stringify(body)}`)
        this.name = "ApiError"
    }
}

let dotenvLoadedFor: string | null = null

function ensureDotenvLoaded(cwd: string = process.cwd()): void {
    if (dotenvLoadedFor === cwd) return
    const envPath = path.resolve(cwd, ".env")
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, quiet: true })
    }
    dotenvLoadedFor = cwd
}

export function readEnvVar(name: string): string | null {
    ensureDotenvLoaded()
    return process.env[name] || null
}

export function readEnvVarFromDir(dir: string, name: string): string | null {
    const envPath = path.resolve(dir, ".env")
    if (!fs.existsSync(envPath)) return null
    const parsed = dotenv.parse(fs.readFileSync(envPath))
    return parsed[name] || null
}

export function readApiKey(): string | null {
    ensureDotenvLoaded()

    const fromProcessEnv = process.env.TERSE_API_KEY
    if (fromProcessEnv) return fromProcessEnv

    const fromUserConfig = getStoredApiKey()
    if (fromUserConfig) {
        process.env.TERSE_API_KEY = fromUserConfig
        return fromUserConfig
    }

    return null
}

export function readApiKeyFromDir(dir: string): string | null {
    return readEnvVarFromDir(dir, "TERSE_API_KEY")
}

export function readApiKeyOrBail(options?: { title?: string; detail?: string }): string {
    const apiKey = readApiKey()
    if (apiKey) return apiKey

    throw new CliError("not_authenticated", options?.title?.trim() || "Not authenticated. Run `terse login` first.", {
        detail: options?.detail?.trim() || "Run `terse login` to authenticate, or set TERSE_API_KEY in your environment.",
        actionRequired: true,
        exitCode: ErrorCode.BAD_ARGUMENTS
    })
}

export function readRunId(): string | null {
    return readEnvVar("TERSE_RUN_ID")
}

type AuthenticatedRequestMethod = "GET" | "POST" | "DELETE"

async function fetchRawWithAuth(
    urlPath: string,
    apiKey: string,
    options: {
        params?: Record<string, unknown>
        type?: AuthenticatedRequestMethod
        sessionId?: string
    } = {}
): Promise<Response> {
    const { params = {}, type = "GET", sessionId } = options

    let res: Response
    try {
        res = await fetch(`${BACKEND_URL}${urlPath}`, {
            method: type,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                ...(sessionId ? { "x-terse-session-id": sessionId } : {})
            },
            body: type === "GET" || type === "DELETE" ? undefined : JSON.stringify(params)
        })
    } catch (err: any) {
        throw new Error(`Could not connect to ${BACKEND_URL} — is the backend running?\n  ${err.message}`)
    }

    return res
}

export async function fetchWithAuthAndSession<T>(urlPath: string, apiKey: string, sessionId: string, params: Record<string, unknown> = {}, type: AuthenticatedRequestMethod = "GET"): Promise<T> {
    const res = await fetchRawWithAuth(urlPath, apiKey, { params, type, sessionId })

    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
        throw new Error(`Expected JSON from ${urlPath} but got ${contentType || "unknown content-type"} (HTTP ${res.status}).\n` + `  Is the Terse backend running on ${BACKEND_URL}?`)
    }

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new ApiError(res.status, body)
    }

    return res.json() as Promise<T>
}

export async function fetchWithAuth<T>(urlPath: string, apiKey: string, params: Record<string, unknown> = {}, type: AuthenticatedRequestMethod = "GET"): Promise<T> {
    const res = await fetchRawWithAuth(urlPath, apiKey, { params, type })

    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
        throw new Error(`Expected JSON from ${urlPath} but got ${contentType || "unknown content-type"} (HTTP ${res.status}).\n` + `  Is the Terse backend running on ${BACKEND_URL}?`)
    }

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new ApiError(res.status, body)
    }

    return res.json() as Promise<T>
}

export async function resolveAgentIdByJobName(jobName: string, apiKey: string): Promise<string | null> {
    const search = encodeURIComponent(jobName)
    const response = await fetchWithAuth<AgentsResponse>(`${ApiRoutes.AGENTS.LIST}?search=${search}&pageSize=100`, apiKey)
    const exact = response.agents.find(agent => agent.name === jobName)
    return exact?.id ?? null
}

export async function fetchRunHistory(agentId: string, apiKey: string, params: GetRunHistoryParams = {}): Promise<GetRunHistoryResponse> {
    const usp = new URLSearchParams()
    if (params.q) usp.set("q", params.q)
    if (params.start) usp.set("start", params.start)
    if (params.end) usp.set("end", params.end)
    if (params.status?.length) usp.set("status", params.status.join(","))
    if (params.page) usp.set("page", String(params.page))
    if (params.pageSize) usp.set("pageSize", String(params.pageSize))

    const base = buildRoute(ApiRoutes.RUN_HISTORY.BY_AGENT_ID, { agentId })
    const url = usp.toString() ? `${base}?${usp.toString()}` : base
    const result = await fetchWithAuth<GetRunHistoryResponse>(url, apiKey)
    return result
}

export type RunChatHistory = {
    events: RunHistoryModelEvent[]
    startTimestamp: string
    endTimestamp: string
    status: string
    triggerEvent: string | null
    triggerEventType: string | null
    isTriggerEventTruncated: boolean
}

export async function fetchRunChatHistory(runId: string, apiKey: string): Promise<RunChatHistory> {
    return fetchWithAuth<RunChatHistory>(buildRoute(ApiRoutes.RUN_HISTORY.CHAT_BY_RUN_ID, { runId }), apiKey)
}

export async function resolveEventFromRunId(runId: string | null, apiKey: string): Promise<SdkRunTriggerEventResponse | undefined> {
    if (!runId) {
        return undefined
    }

    try {
        const response = await fetchWithAuth<SdkRunTriggerEventResponse>(buildRoute(ApiRoutes.SDK.RUN_TRIGGER_EVENT, { runId }), apiKey)
        return sdkRunTriggerEventResponseSchema.parse(response)
    } catch (error) {
        console.error(chalk.red(`Error: Could not fetch the trigger event for run ${runId}.`))
        console.error(chalk.dim(error instanceof Error ? error.message : String(error)))
        process.exit(1)
    }
}
