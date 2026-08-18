import { resolveRunIdentity } from "./runIdentity/index.js"

declare const process: { env: Record<string, string | undefined> }

export class MissingProjectKeyError extends Error {
    constructor() {
        super("TERSE_PROJECT_KEY is not set. Add it to your .env file or export it before starting your server.")
        this.name = "MissingProjectKeyError"
    }
}

export function resolveTerseBackendUrl(): string {
    return process.env.TERSE_BACKEND_URL || "https://api.useterse.ai"
}

export function resolveApiBaseUrl(): string {
    return resolveTerseBackendUrl()
}

export function resolveProjectKey(): string {
    const projectKey = process.env.TERSE_PROJECT_KEY
    if (!projectKey) {
        throw new MissingProjectKeyError()
    }
    return projectKey
}

export async function buildSdkRequestHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
        Authorization: `Bearer ${resolveProjectKey()}`,
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
