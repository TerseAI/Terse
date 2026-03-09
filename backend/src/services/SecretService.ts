import { gcp } from "../config/settings"
import logger from "../logger"
import { SecretManagerClient, getSecretManagerClient } from "../utility/secretManagerClient"

export const GSM_SENTINEL = "gsm"

const SECRET_CACHE_TTL_MS = 5 * 60 * 1000

interface CachedSecret {
    value: string
    expiresAt: number
}

export class SecretService {
    private cache = new Map<string, CachedSecret>()
    private secretManagerClient: SecretManagerClient | null = null
    private clientInitializationFailed = false
    private hasLoggedMissingConfig = false

    isGsmAvailable(): boolean {
        return Boolean(gcp.serviceAccountBase64 && gcp.projectId)
    }

    private getClient(): SecretManagerClient | null {
        if (!this.isGsmAvailable()) {
            if (!this.hasLoggedMissingConfig) {
                logger.info("GSM is not configured. Falling back to database-backed secrets.")
                this.hasLoggedMissingConfig = true
            }
            return null
        }

        if (this.secretManagerClient) {
            return this.secretManagerClient
        }

        if (this.clientInitializationFailed) {
            return null
        }

        try {
            this.secretManagerClient = getSecretManagerClient()
            return this.secretManagerClient
        } catch (error) {
            this.clientInitializationFailed = true
            logger.error("Failed to initialize Secret Manager client. Falling back to database-backed secrets.", { error })
            return null
        }
    }

    private sanitizeSecretIdComponent(component: string): string {
        return component.replace(/[^a-zA-Z0-9_-]/g, "-")
    }

    private buildSecretId(table: string, recordId: string, field: string): string {
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

    async storeSecret(table: string, recordId: string, field: string, value: string): Promise<string> {
        const client = this.getClient()
        if (!client) {
            return value
        }

        const secretId = this.buildSecretId(table, recordId, field)
        await client.createOrUpdateSecret(secretId, value)
        this.cache.delete(secretId)
        return GSM_SENTINEL
    }

    async getSecret(table: string, recordId: string, field: string, dbValue: string | null): Promise<string | null> {
        if (dbValue === null) {
            return null
        }

        if (dbValue !== GSM_SENTINEL) {
            return dbValue
        }

        const client = this.getClient()
        if (!client) {
            logger.warn("Encountered GSM sentinel without Secret Manager availability; returning sentinel value", {
                table,
                recordId,
                field
            })
            return dbValue
        }

        const secretId = this.buildSecretId(table, recordId, field)

        const cached = this.getCachedSecret(secretId)
        if (cached !== null) {
            return cached
        }

        const value = await client.getSecret(secretId)
        this.setCachedSecret(secretId, value)
        return value
    }

    async deleteSecret(table: string, recordId: string, field: string): Promise<void> {
        const secretId = this.buildSecretId(table, recordId, field)
        this.cache.delete(secretId)

        const client = this.getClient()
        if (!client) {
            return
        }

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

export async function storeSecret(table: string, recordId: string, field: string, value: string): Promise<string> {
    return getSecretService().storeSecret(table, recordId, field, value)
}

export async function getSecret(table: string, recordId: string, field: string, dbValue: string | null): Promise<string | null> {
    return getSecretService().getSecret(table, recordId, field, dbValue)
}

export async function deleteSecret(table: string, recordId: string, field: string): Promise<void> {
    return getSecretService().deleteSecret(table, recordId, field)
}

export function isGsmAvailable(): boolean {
    return getSecretService().isGsmAvailable()
}
