import { IntegrationType } from "terse-types/Integrations"

import { gcp } from "../config/settings"
import logger from "../logger"
import { SecretManagerClient, getSecretManagerClient, isSecretManagerNotFoundError } from "../utility/secretManagerClient"

/** System integrations that do not store secrets in GCP Secret Manager. */
type SystemIntegration = IntegrationType.TERSE | IntegrationType.CRON_JOB

/**
 * Integration types that store secrets. Derived from IntegrationType via Exclude,
 * so adding a new IntegrationType automatically includes it here unless it is
 * added to SystemIntegration.
 */
export type SecretIntegrationType = Exclude<IntegrationType, SystemIntegration>

export enum SecretField {
    AccessToken = "access_token",
    RefreshToken = "refresh_token",
    ApiKey = "api_key",
    AppKey = "app_key",
    IntegrationToken = "integration_token",
    WebhookSecret = "webhook_secret",
    AuthedUserAccessToken = "authed_user_access_token",
    PrivateKey = "private_key",
    PrivateKeyPassphrase = "private_key_passphrase"
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

    private buildSecretId(integrationType: SecretIntegrationType, recordId: string, field: SecretField): string {
        const secretId = `${this.sanitizeSecretIdComponent(integrationType)}-${this.sanitizeSecretIdComponent(recordId)}-${this.sanitizeSecretIdComponent(field)}`
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

    async storeSecret(integrationType: SecretIntegrationType, recordId: string, field: SecretField, value: string): Promise<void> {
        const client = this.getClient()
        const secretId = this.buildSecretId(integrationType, recordId, field)
        await client.createOrUpdateSecret(secretId, value)
        this.cache.delete(secretId)
    }

    async getSecret(integrationType: SecretIntegrationType, recordId: string, field: SecretField): Promise<string | null> {
        const client = this.getClient()
        const secretId = this.buildSecretId(integrationType, recordId, field)

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

    async deleteSecret(integrationType: SecretIntegrationType, recordId: string, field: SecretField): Promise<void> {
        const secretId = this.buildSecretId(integrationType, recordId, field)
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

export async function storeSecret(integrationType: SecretIntegrationType, recordId: string, field: SecretField, value: string): Promise<void> {
    return getSecretService().storeSecret(integrationType, recordId, field, value)
}

export async function getSecret(integrationType: SecretIntegrationType, recordId: string, field: SecretField): Promise<string | null> {
    return getSecretService().getSecret(integrationType, recordId, field)
}

export async function deleteSecret(integrationType: SecretIntegrationType, recordId: string, field: SecretField): Promise<void> {
    return getSecretService().deleteSecret(integrationType, recordId, field)
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
export async function deleteSecretsBestEffort(entries: Array<{ integrationType: SecretIntegrationType; recordId: string; field: SecretField }>): Promise<void> {
    const service = getSecretService()
    await Promise.allSettled(
        entries.map(async entry => {
            try {
                await service.deleteSecret(entry.integrationType, entry.recordId, entry.field)
            } catch (error) {
                logger.error("Best-effort GSM secret cleanup failed (orphaned secret)", {
                    integrationType: entry.integrationType,
                    recordId: entry.recordId,
                    field: entry.field,
                    error
                })
            }
        })
    )
}
