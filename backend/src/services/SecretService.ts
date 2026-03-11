import { gcp } from "../config/settings"
import logger from "../logger"
import { SecretManagerClient, getSecretManagerClient, isSecretManagerNotFoundError } from "../utility/secretManagerClient"

export enum SecretTable {
    SlackIntegrations = "slack_integrations",
    UserSlackIntegrations = "user_slack_integrations",
    NotionIntegrations = "notion_integrations",
    LaunchDarklyIntegrations = "launchdarkly_integrations",
    LinearIntegrations = "linear_integrations",
    GmailIntegrations = "gmail_integrations",
    AtlassianIntegrations = "atlassian_integrations",
    FigmaIntegrations = "figma_integrations",
    WorkOSIntegrations = "workos_integrations",
    PosthogIntegrations = "posthog_integrations",
    DatadogIntegrations = "datadog_integrations",
    GithubAppTokens = "github_app_tokens",
    AttioIntegrations = "attio_integrations"
}

export enum SecretField {
    AccessToken = "access_token",
    RefreshToken = "refresh_token",
    ApiKey = "api_key",
    AppKey = "app_key",
    IntegrationToken = "integration_token",
    WebhookSecret = "webhook_secret",
    AuthedUserAccessToken = "authed_user_access_token"
}

const SECRET_CACHE_TTL_MS = 5 * 60 * 1000

interface CachedSecret {
    value: string
    expiresAt: number
}

export class SecretService {
    private cache = new Map<string, CachedSecret>()
    private secretManagerClient: SecretManagerClient | null = null
    private clientInitializationFailed = false

    isGsmAvailable(): boolean {
        return Boolean(gcp.serviceAccountBase64 && gcp.projectId)
    }

    private getClient(): SecretManagerClient {
        if (!this.isGsmAvailable()) {
            throw new Error("GSM is not configured. Hard cutover requires GCP_SERVICE_ACCOUNT_BASE64 and GCP_PROJECT_ID.")
        }

        if (this.secretManagerClient) {
            return this.secretManagerClient
        }

        if (this.clientInitializationFailed) {
            throw new Error("Secret Manager client initialization previously failed")
        }

        try {
            this.secretManagerClient = getSecretManagerClient()
            return this.secretManagerClient
        } catch (error) {
            this.clientInitializationFailed = true
            logger.error("Failed to initialize Secret Manager client.", { error })
            throw error
        }
    }

    private sanitizeSecretIdComponent(component: string): string {
        return component.replace(/[^a-zA-Z0-9_-]/g, "-")
    }

    private buildSecretId(table: SecretTable, recordId: string, field: SecretField): string {
        const secretId = `${this.sanitizeSecretIdComponent(table)}-${this.sanitizeSecretIdComponent(recordId)}-${this.sanitizeSecretIdComponent(field)}`
        return secretId.slice(0, 255)
    }

    private getCachedSecret(secretId: string): string | null {
        const cached = this.cache.get(secretId)
        if (!cached) {
            return null
        }

        if (Date.now() >= cached.expiresAt) {
            this.cache.delete(secretId)
            return null
        }

        return cached.value
    }

    private setCachedSecret(secretId: string, value: string): void {
        this.cache.set(secretId, {
            value,
            expiresAt: Date.now() + SECRET_CACHE_TTL_MS
        })
    }

    async storeSecret(table: SecretTable, recordId: string, field: SecretField, value: string): Promise<void> {
        const client = this.getClient()
        const secretId = this.buildSecretId(table, recordId, field)
        await client.createOrUpdateSecret(secretId, value)
        this.cache.delete(secretId)
    }

    async getSecret(table: SecretTable, recordId: string, field: SecretField): Promise<string | null> {
        const client = this.getClient()
        const secretId = this.buildSecretId(table, recordId, field)

        const cached = this.getCachedSecret(secretId)
        if (cached !== null) {
            return cached
        }

        try {
            const value = await client.getSecret(secretId)
            this.setCachedSecret(secretId, value)
            return value
        } catch (error) {
            if (isSecretManagerNotFoundError(error)) {
                return null
            }
            throw error
        }
    }

    async deleteSecret(table: SecretTable, recordId: string, field: SecretField): Promise<void> {
        const secretId = this.buildSecretId(table, recordId, field)
        this.cache.delete(secretId)

        const client = this.getClient()
        await client.deleteSecret(secretId)
    }
}

let secretService: SecretService | null = null

export function getSecretService(): SecretService {
    if (!secretService) {
        secretService = new SecretService()
    }
    return secretService
}

export async function storeSecret(table: SecretTable, recordId: string, field: SecretField, value: string): Promise<void> {
    return getSecretService().storeSecret(table, recordId, field, value)
}

export async function getSecret(table: SecretTable, recordId: string, field: SecretField): Promise<string | null> {
    return getSecretService().getSecret(table, recordId, field)
}

export async function deleteSecret(table: SecretTable, recordId: string, field: SecretField): Promise<void> {
    return getSecretService().deleteSecret(table, recordId, field)
}

export function isGsmAvailable(): boolean {
    return getSecretService().isGsmAvailable()
}

/**
 * Best-effort secret cleanup for use after DB deletes.
 * Logs errors instead of throwing so the caller's DB delete is never rolled back
 * due to a GSM failure. Orphaned GSM secrets are harmless since the DB record
 * they belonged to no longer exists.
 */
export async function deleteSecretsBestEffort(entries: Array<{ table: SecretTable; recordId: string; field: SecretField }>): Promise<void> {
    const service = getSecretService()
    await Promise.allSettled(
        entries.map(async entry => {
            try {
                await service.deleteSecret(entry.table, entry.recordId, entry.field)
            } catch (error) {
                logger.error("Best-effort GSM secret cleanup failed (orphaned secret)", {
                    table: entry.table,
                    recordId: entry.recordId,
                    field: entry.field,
                    error
                })
            }
        })
    )
}
