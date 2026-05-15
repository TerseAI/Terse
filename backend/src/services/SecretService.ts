import { IntegrationType } from "terse-types/Integrations"

import { gcp } from "../config/settings"
import logger from "../logger"
import { SecretManagerClient, getSecretManagerClient } from "../utility/secretManagerClient"

let cachedClient: SecretManagerClient | null = null
let clientInitFailed = false

export function isGsmAvailable(): boolean {
    return Boolean(gcp.serviceAccountBase64 && gcp.projectId)
}

export async function createSecret(ref: SecretRef, value: string): Promise<void> {
    await getClient().createOrUpdateSecret(buildSecretId(ref), value)
}

export async function getSecret(ref: SecretRef): Promise<string | null> {
    return getClient().getSecret(buildSecretId(ref))
}

export async function deleteManySecrets(refs: SecretRef[]): Promise<void> {
    const client = getClient()
    const results = await Promise.allSettled(refs.map(ref => client.deleteSecret(buildSecretId(ref))))

    const failures = results.flatMap((r, i) => (r.status === "rejected" ? [{ secretId: buildSecretId(refs[i]), reason: r.reason }] : []))

    if (failures.length > 0) {
        logger.error("Failed to delete some secrets", {
            failureCount: failures.length,
            totalCount: refs.length,
            failures
        })
    }
}

function buildSecretId(ref: SecretRef): string {
    return secretIdComponents(ref)
        .map(c => c.replace(/[^a-zA-Z0-9_-]/g, "-"))
        .join("-")
        .slice(0, 255)
}

function secretIdComponents(ref: SecretRef): string[] {
    switch (ref.type) {
        case "project":
            return ["project", ref.params.projectId, ref.params.name]
        case "integration":
            return [ref.params.integrationType, ref.params.recordId, ref.params.field]
    }
}

function getClient(): SecretManagerClient {
    if (!isGsmAvailable()) {
        throw new Error("GSM is not configured.")
    }
    if (cachedClient) return cachedClient
    if (clientInitFailed) {
        throw new Error("Secret Manager client initialization previously failed")
    }
    try {
        cachedClient = getSecretManagerClient()
        return cachedClient
    } catch (error) {
        clientInitFailed = true
        logger.error("Failed to initialize Secret Manager client.", { error })
        throw error
    }
}

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

export type SecretRef = { type: "project"; params: ProjectSecret } | { type: "integration"; params: IntegrationSecret }

type ProjectSecret = {
    projectId: string
    name: string
}

type IntegrationSecret = {
    integrationType: SecretIntegrationType
    recordId: string
    field: SecretField
}

type SecretIntegrationType = Exclude<IntegrationType, SystemIntegration>
type SystemIntegration = IntegrationType.TERSE | IntegrationType.CRON_JOB
