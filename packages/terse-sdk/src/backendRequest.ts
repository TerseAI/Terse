import { resolveRunIdentity } from "./runIdentity/index.js"

declare const process: { env: Record<string, string | undefined> }

export function resolveTerseBackendUrl(): string {
    return process.env.TERSE_BACKEND_URL || "https://api.useterse.ai"
}

export function resolveApiBaseUrl(): string {
    return resolveTerseBackendUrl()
}

export async function buildSdkRequestHeaders(): Promise<Record<string, string>> {
    const apiKey = process.env.TERSE_API_KEY
    if (!apiKey) {
        throw new Error("TERSE_API_KEY environment variable is not set.")
    }
    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream"
    }
    const { sessionId, runId, projectId, jobName } = await resolveRunIdentity()
    if (sessionId) headers["X-Terse-Session-Id"] = sessionId
    if (runId) headers["X-Terse-Run-Id"] = runId
    if (projectId) headers["X-Terse-Project-Id"] = projectId
    if (jobName) headers["X-Terse-Job-Name"] = jobName
    return headers
}
