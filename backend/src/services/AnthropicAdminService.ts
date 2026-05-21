import axios, { AxiosError } from "axios"

import { settings } from "../config/settings"
import logger from "../logger"

const ANTHROPIC_ADMIN_BASE = "https://api.anthropic.com/v1"
const ANTHROPIC_VERSION = "2023-06-01"

interface MintEphemeralKeyOpts {
    label: string
}

interface MintedKey {
    keyId: string
    apiKey: string
}

interface CreateKeyResponse {
    id: string
    name: string
    api_key: string
    status: string
    workspace_id?: string | null
}

interface ListKeyEntry {
    id: string
    name: string
    status: string
    workspace_id?: string | null
    created_at: string
}

interface ListKeyResponse {
    data: ListKeyEntry[]
    has_more: boolean
    last_id?: string | null
}

export class AnthropicAdminService {
    private readonly adminApiKey: string
    private readonly workspaceId: string

    constructor() {
        this.adminApiKey = settings.anthropic.adminApiKey
        this.workspaceId = settings.anthropic.improvementWorkspaceId
    }

    async mintEphemeralKey(opts: MintEphemeralKeyOpts): Promise<MintedKey> {
        const url = `${ANTHROPIC_ADMIN_BASE}/organizations/api_keys`
        const name = `terse-improvement-${opts.label}`

        try {
            const response = await axios.post<CreateKeyResponse>(
                url,
                { name, workspace_id: this.workspaceId },
                {
                    headers: {
                        "x-api-key": this.adminApiKey,
                        "anthropic-version": ANTHROPIC_VERSION,
                        "content-type": "application/json"
                    },
                    timeout: 15_000
                }
            )

            logger.info("[AnthropicAdmin] Minted ephemeral key", { keyId: response.data.id, name })
            return { keyId: response.data.id, apiKey: response.data.api_key }
        } catch (error) {
            const status = error instanceof AxiosError ? error.response?.status : undefined
            logger.error("[AnthropicAdmin] Failed to mint ephemeral key", { name, status, error: errorMessage(error) })
            throw new Error(`Failed to mint Anthropic ephemeral key: ${errorMessage(error)}`)
        }
    }

    async revokeKey(keyId: string): Promise<void> {
        const url = `${ANTHROPIC_ADMIN_BASE}/organizations/api_keys/${encodeURIComponent(keyId)}`

        try {
            await axios.post(
                url,
                { status: "inactive" },
                {
                    headers: {
                        "x-api-key": this.adminApiKey,
                        "anthropic-version": ANTHROPIC_VERSION,
                        "content-type": "application/json"
                    },
                    timeout: 15_000
                }
            )

            logger.info("[AnthropicAdmin] Revoked ephemeral key", { keyId })
        } catch (error) {
            const status = error instanceof AxiosError ? error.response?.status : undefined
            logger.error("[AnthropicAdmin] Failed to revoke ephemeral key", { keyId, status, error: errorMessage(error) })
            // Don't rethrow — caller is in a finally{} block, and the reaper
            // will catch any orphans later.
        }
    }

    async listImprovementKeys(): Promise<ListKeyEntry[]> {
        const url = `${ANTHROPIC_ADMIN_BASE}/organizations/api_keys`
        const out: ListKeyEntry[] = []
        let cursor: string | undefined

        for (let page = 0; page < 50; page++) {
            const response = await axios.get<ListKeyResponse>(url, {
                headers: {
                    "x-api-key": this.adminApiKey,
                    "anthropic-version": ANTHROPIC_VERSION
                },
                params: {
                    limit: 100,
                    workspace_id: this.workspaceId,
                    ...(cursor ? { after_id: cursor } : {})
                },
                timeout: 15_000
            })

            for (const key of response.data.data) {
                if (key.name.startsWith("terse-improvement-")) {
                    out.push(key)
                }
            }

            if (!response.data.has_more || !response.data.last_id) {
                break
            }
            cursor = response.data.last_id
        }

        return out
    }

    /**
     * Anthropic does not document propagation delay for newly minted Admin-API
     * keys. We probe the key with a 1-token messages.create before handing it
     * to the proxy so the actual Claude Code run does not race a stale 401.
     */
    async probeKey(apiKey: string): Promise<void> {
        const url = `${ANTHROPIC_ADMIN_BASE}/messages`
        const body = {
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1,
            messages: [{ role: "user", content: "ping" }]
        }
        const headers = {
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json"
        }

        let lastError: unknown
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await axios.post(url, body, { headers, timeout: 10_000 })
                return
            } catch (error) {
                lastError = error
                const status = error instanceof AxiosError ? error.response?.status : undefined
                logger.warn("[AnthropicAdmin] Probe failed, retrying", { attempt, status, error: errorMessage(error) })
                await sleep(1_000 * 2 ** attempt)
            }
        }
        throw new Error(`Anthropic key probe failed after retries: ${errorMessage(lastError)}`)
    }
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))
