import chalk from "chalk"
import dotenv from "dotenv"
import fs from "node:fs"
import path from "node:path"
import { ApiRoutes, buildRoute, sdkRunTriggerEventResponseSchema } from "terse-types"
import type { AgentsResponse, GetRunHistoryParams, GetRunHistoryResponse, RunHistoryModelEvent, SdkRunTriggerEventResponse, SerializedEvent } from "terse-types"

import { BACKEND_URL } from "./config.js"
import { getStoredApiKey } from "./userConfig.js"

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

    console.error(options?.title ? chalk.red(options.title) : chalk.red("\n  Not authenticated. Run `terse login` first.\n"))

    if (options?.detail) {
        console.error(chalk.dim(options.detail))
    }

    process.exit(1)
}

export function readRunId(): string | null {
    return readEnvVar("TERSE_RUN_ID")
}

export async function fetchWithAuth<T>(urlPath: string, apiKey: string, params: Record<string, unknown> = {}, type: "GET" | "POST" = "GET"): Promise<T> {
    let res: Response
    try {
        res = await fetch(`${BACKEND_URL}${urlPath}`, {
            method: type,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: type === "POST" ? JSON.stringify(params) : undefined
        })
    } catch (err: any) {
        throw new Error(`Could not connect to ${BACKEND_URL} — is the backend running?\n  ${err.message}`)
    }

    const contentType = res.headers.get("content-type") ?? ""
    if (!contentType.includes("application/json")) {
        throw new Error(`Expected JSON from ${urlPath} but got ${contentType || "unknown content-type"} (HTTP ${res.status}).\n` + `  Is the Terse backend running on ${BACKEND_URL}?`)
    }

    if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
        throw new Error(`${res.status} ${res.statusText} — ${urlPath}\n  ${body.error || JSON.stringify(body)}`)
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
