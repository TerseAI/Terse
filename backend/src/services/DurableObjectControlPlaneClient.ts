import type { DurableObjectStorageRegion } from "terse-types/ExecutionRegions"
import { z } from "zod"

const registerDeploymentResponseSchema = z.object({ changed: z.boolean() })
const workflowTokenResponseSchema = z.object({
    token: z.string().min(1),
    expiresAtMs: z.number().int().positive()
})

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000
const MAX_ERROR_BODY_LENGTH = 500

export class DurableObjectControlPlaneClient implements DurableObjectControlPlane {
    private static instance: DurableObjectControlPlaneClient | undefined

    readonly controlPlaneUrl: string

    private readonly adminToken: string
    private readonly requestTimeoutMs: number

    private constructor(
        config: DurableObjectControlPlaneConfig,
        private readonly fetchClient: FetchClient
    ) {
        this.controlPlaneUrl = normalizeControlPlaneUrl(config.controlPlaneUrl)
        this.adminToken = config.adminToken
        this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    }

    static getInstance(config: DurableObjectControlPlaneConfig): DurableObjectControlPlane {
        if (!DurableObjectControlPlaneClient.instance) {
            DurableObjectControlPlaneClient.instance = new DurableObjectControlPlaneClient(config, globalThis.fetch)
        }
        return DurableObjectControlPlaneClient.instance
    }

    static createForTesting(config: DurableObjectControlPlaneConfig, fetchClient: FetchClient = globalThis.fetch): DurableObjectControlPlane {
        return new DurableObjectControlPlaneClient(config, fetchClient)
    }

    async registerDeployment(namespaceId: string, deployment: DurableObjectDeployment): Promise<{ changed: boolean }> {
        return this.request(
            `/v1/namespaces/${pathSegment(namespaceId)}/deployment`,
            {
                method: "PUT",
                body: JSON.stringify(deployment)
            },
            registerDeploymentResponseSchema
        )
    }

    async issueWorkflowToken(namespaceId: string, executionId: string, storageRegion: DurableObjectStorageRegion, deadlineUnixMs: number): Promise<DurableObjectWorkflowToken> {
        return this.request(
            `/v1/namespaces/${pathSegment(namespaceId)}/workflow-tokens`,
            {
                method: "POST",
                body: JSON.stringify({ executionId, storageRegion, deadlineUnixMs })
            },
            workflowTokenResponseSchema
        )
    }

    private async request<T>(path: string, init: DurableObjectRequestInit, schema: z.ZodType<T>): Promise<T> {
        const response = await this.send(path, init)
        if (!response.ok) {
            throw await errorForResponse(response)
        }

        const body = await parseResponseBody(response)
        const parsed = schema.safeParse(body)
        if (!parsed.success) {
            throw new DurableObjectControlPlaneError("Durable-object control plane returned an invalid response", { cause: parsed.error })
        }
        return parsed.data
    }

    private async send(path: string, init: DurableObjectRequestInit): Promise<Response> {
        try {
            return await this.fetchClient(`${this.controlPlaneUrl}${path}`, {
                ...init,
                headers: {
                    Authorization: `Bearer ${this.adminToken}`,
                    Accept: "application/json",
                    ...(init.body ? { "Content-Type": "application/json" } : {})
                },
                signal: AbortSignal.timeout(this.requestTimeoutMs)
            })
        } catch (error) {
            throw new DurableObjectControlPlaneError(`Durable-object control plane request failed: ${errorMessage(error)}`, { cause: error })
        }
    }
}

async function errorForResponse(response: Response): Promise<DurableObjectControlPlaneError> {
    const detail = (await responseText(response)).trim().slice(0, MAX_ERROR_BODY_LENGTH)
    return new DurableObjectControlPlaneError(`Durable-object control plane returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`)
}

async function responseText(response: Response): Promise<string> {
    try {
        return await response.text()
    } catch {
        return ""
    }
}

async function parseResponseBody(response: Response): Promise<unknown> {
    try {
        return await response.json()
    } catch (error) {
        throw new DurableObjectControlPlaneError("Durable-object control plane returned invalid JSON", { cause: error })
    }
}

function normalizeControlPlaneUrl(value: string): string {
    const url = parseControlPlaneUrl(value)
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new DurableObjectControlPlaneError("DURABLE_OBJECT_CONTROL_PLANE_URL must be an HTTP(S) origin without credentials, path, query, or fragment")
    }
    return url.origin
}

function parseControlPlaneUrl(value: string): URL {
    try {
        return new URL(value)
    } catch (error) {
        throw new DurableObjectControlPlaneError("DURABLE_OBJECT_CONTROL_PLANE_URL must be a valid URL", { cause: error })
    }
}

function pathSegment(value: string): string {
    if (!value) throw new DurableObjectControlPlaneError("Durable-object namespace ID must not be empty")
    return encodeURIComponent(value)
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export class DurableObjectControlPlaneError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options)
        this.name = "DurableObjectControlPlaneError"
    }
}

export interface DurableObjectControlPlane {
    readonly controlPlaneUrl: string
    registerDeployment(namespaceId: string, deployment: DurableObjectDeployment): Promise<{ changed: boolean }>
    issueWorkflowToken(namespaceId: string, executionId: string, storageRegion: DurableObjectStorageRegion, deadlineUnixMs: number): Promise<DurableObjectWorkflowToken>
}

export interface DurableObjectControlPlaneConfig {
    readonly controlPlaneUrl: string
    readonly adminToken: string
    readonly requestTimeoutMs?: number
}

export interface DurableObjectDeployment {
    readonly codeRevision: string
    readonly imageRef: string
    readonly workingDirectory: string
    readonly actorEntrypoint?: string
    readonly warmRegion?: DurableObjectStorageRegion
}

export interface DurableObjectWorkflowToken {
    readonly token: string
    readonly expiresAtMs: number
}

type DurableObjectRequestInit = { method: "POST" | "PUT"; body?: string }
type FetchClient = typeof globalThis.fetch
