import { z } from "zod"

// Browser sockets and local tests have no Modal sandbox location.
export const DURABLE_OBJECT_STORAGE_REGION = "north-america-east"

const registerDeploymentResponseSchema = z.object({ changed: z.boolean() })
const workflowTokenResponseSchema = z.object({
    token: z.string().min(1),
    expiresAtMs: z.number().int().positive()
})

export class DurableObjectControlPlaneClient implements DurableObjectControlPlane {
    private static instance: DurableObjectControlPlaneClient | undefined

    readonly controlPlaneUrl: string

    constructor(
        private readonly config: DurableObjectControlPlaneConfig,
        private readonly fetchClient: typeof globalThis.fetch = globalThis.fetch
    ) {
        this.controlPlaneUrl = normalizeControlPlaneUrl(config.controlPlaneUrl)
    }

    static getInstance(config: DurableObjectControlPlaneConfig): DurableObjectControlPlane {
        return (DurableObjectControlPlaneClient.instance ??= new DurableObjectControlPlaneClient(config))
    }

    async registerDeployment(namespaceId: string, deployment: DurableObjectDeployment): Promise<{ changed: boolean }> {
        return this.request(`/v1/namespaces/${pathSegment(namespaceId)}/deployment`, { method: "PUT", body: JSON.stringify(deployment) }, registerDeploymentResponseSchema)
    }

    async issueWorkflowToken(namespaceId: string, executionId: string, storageRegion: string, deadlineUnixMs: number): Promise<DurableObjectWorkflowToken> {
        return this.request(
            `/v1/namespaces/${pathSegment(namespaceId)}/workflow-tokens`,
            { method: "POST", body: JSON.stringify({ executionId, storageRegion, deadlineUnixMs }) },
            workflowTokenResponseSchema
        )
    }

    private async request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
        const response = await this.fetchClient(`${this.controlPlaneUrl}${path}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${this.config.adminToken}`,
                Accept: "application/json",
                "Content-Type": "application/json"
            },
            signal: AbortSignal.timeout(this.config.requestTimeoutMs ?? 10_000)
        })
        if (!response.ok) {
            const detail = (await response.text().catch(() => "")).trim().slice(0, 500)
            throw new Error(`Durable-object control plane returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`)
        }
        return schema.parse(await response.json())
    }
}

function normalizeControlPlaneUrl(value: string): string {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error("DURABLE_OBJECT_CONTROL_PLANE_URL must be an HTTP(S) origin without credentials, path, query, or fragment")
    }
    return url.origin
}

function pathSegment(value: string): string {
    if (!value) throw new Error("Durable-object namespace ID must not be empty")
    return encodeURIComponent(value)
}

export interface DurableObjectControlPlane {
    readonly controlPlaneUrl: string
    registerDeployment(namespaceId: string, deployment: DurableObjectDeployment): Promise<{ changed: boolean }>
    issueWorkflowToken(namespaceId: string, executionId: string, storageRegion: string, deadlineUnixMs: number): Promise<DurableObjectWorkflowToken>
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
}

export interface DurableObjectWorkflowToken {
    readonly token: string
    readonly expiresAtMs: number
}
