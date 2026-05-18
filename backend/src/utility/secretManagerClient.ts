import { SecretManagerServiceClient } from "@google-cloud/secret-manager"
import Bottleneck from "bottleneck"

import { gcp } from "../config/settings"
import logger from "../logger"

const GRPC_NOT_FOUND = 5
const GRPC_ALREADY_EXISTS = 6
const GRPC_FAILED_PRECONDITION = 9
const SECRET_MANAGER_REQUESTS_PER_MINUTE = 600
const SECRET_MANAGER_RATE_LIMIT_FRACTION = 0.25
const SECRET_MANAGER_MAX_REQUESTS_PER_MINUTE = SECRET_MANAGER_REQUESTS_PER_MINUTE * SECRET_MANAGER_RATE_LIMIT_FRACTION
const SECRET_MANAGER_MIN_INTERVAL_MS = Math.ceil(60_000 / SECRET_MANAGER_MAX_REQUESTS_PER_MINUTE)

interface GrpcError {
    code?: number | string
    message?: string
}

function isGrpcError(error: unknown): error is GrpcError {
    return typeof error === "object" && error !== null && "code" in error
}

export function isSecretManagerNotFoundError(error: unknown): boolean {
    if (!isGrpcError(error)) {
        return false
    }
    // gRPC NOT_FOUND is 5; some client layers stringify the code.
    return error.code === GRPC_NOT_FOUND || error.code === "5"
}

export function isSecretManagerDestroyedError(error: unknown): boolean {
    return isGrpcError(error) && error.code === GRPC_FAILED_PRECONDITION && typeof error.message === "string" && error.message.includes("DESTROYED")
}

type SecretVersionCleanupReport = {
    dryRun: boolean
    numberOfSecretsCleared: number
    numberOfVersionsCleared: number
    numberOfErrors: number
    errors: string[]
    plannedDestructions: Array<{
        secretId: string
        secretPath: string
        versionNames: string[]
        latestEnabledVersionNumber: number
    }>
}

export class SecretManagerClient {
    private client: SecretManagerServiceClient
    private projectId: string

    constructor() {
        try {
            const serviceAccountBase64 = gcp.serviceAccountBase64

            if (!serviceAccountBase64) {
                throw new Error("GCP_SERVICE_ACCOUNT_BASE64 environment variable is required to initialize Secret Manager client")
            }

            const projectId = gcp.projectId
            if (!projectId) {
                throw new Error("GCP_PROJECT_ID environment variable is required to initialize Secret Manager client")
            }

            const location = gcp.region || "us-central1"

            // Decode the base64 service account
            const serviceAccountJson = Buffer.from(serviceAccountBase64, "base64").toString("utf-8")
            const credentials = JSON.parse(serviceAccountJson)

            // Initialize the Cloud Secret Manager client with credentials
            this.client = new SecretManagerServiceClient({
                credentials: credentials
            })
            this.projectId = projectId

            logger.info("Secret Manager client initialized", { projectId, location })
        } catch (error) {
            logger.error("Failed to initialize Secret Manager client", { error })
            throw new Error(`Failed to initialize Secret Manager client: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
    }

    private getParentPath(): string {
        return `projects/${this.projectId}`
    }

    private getSecretPath(secretId: string): string {
        return `${this.getParentPath()}/secrets/${secretId}`
    }

    private getLatestSecretVersionPath(secretId: string): string {
        return `${this.getSecretPath(secretId)}/versions/latest`
    }

    private async createSecretIfMissing(secretId: string): Promise<void> {
        try {
            await this.client.createSecret({
                parent: this.getParentPath(),
                secretId,
                secret: {
                    replication: {
                        automatic: {}
                    }
                }
            })
            logger.info("Created Secret Manager secret", { secretId })
        } catch (error) {
            if (isGrpcError(error) && error.code === GRPC_ALREADY_EXISTS) {
                return
            }
            logger.error("Failed to create Secret Manager secret", { error, secretId })
            throw error
        }
    }

    private extractSecretId(secretName: string | null | undefined): string {
        if (!secretName) {
            throw new Error("Secret name is required")
        }

        const parts = secretName.split("/")
        return parts[parts.length - 1] || secretName
    }

    private extractVersionNumber(versionName: string | null | undefined): number | null {
        if (!versionName) {
            return null
        }

        const parts = versionName.split("/")
        const versionPart = parts[parts.length - 1]
        const versionNumber = Number(versionPart)

        return Number.isInteger(versionNumber) ? versionNumber : null
    }

    private isDestroyedVersion(state: string | number | null | undefined): boolean {
        return state === "DESTROYED" || state === 3
    }

    private isEnabledVersion(state: string | number | null | undefined): boolean {
        return state === "ENABLED" || state === 1
    }

    private createCleanupLimiter(): Bottleneck {
        return new Bottleneck({
            maxConcurrent: 1,
            minTime: SECRET_MANAGER_MIN_INTERVAL_MS
        })
    }

    private async runCleanupRequest<T>(limiter: Bottleneck, request: () => Promise<T>): Promise<T> {
        return limiter.schedule(request)
    }

    private async listAllSecrets(limiter: Bottleneck): Promise<Array<{ name?: string | null }>> {
        const secrets: Array<{ name?: string | null }> = []
        let pageToken: string | undefined

        do {
            const [pageSecrets, , response] = await this.runCleanupRequest(limiter, () =>
                this.client.listSecrets({
                    parent: this.getParentPath(),
                    pageSize: 1000,
                    pageToken
                })
            )

            secrets.push(...pageSecrets)
            pageToken = response?.nextPageToken || undefined
        } while (pageToken)

        return secrets
    }

    private async listAllSecretVersions(secretPath: string, limiter: Bottleneck): Promise<Array<{ name?: string | null; state?: string | number | null }>> {
        const versions: Array<{ name?: string | null; state?: string | number | null }> = []
        let pageToken: string | undefined

        do {
            const [pageVersions, , response] = await this.runCleanupRequest(limiter, () =>
                this.client.listSecretVersions({
                    parent: secretPath,
                    pageSize: 1000,
                    pageToken
                })
            )

            versions.push(...pageVersions)
            pageToken = response?.nextPageToken || undefined
        } while (pageToken)

        return versions
    }

    async clearOldSecretVersions(options?: { dryRun?: boolean }): Promise<SecretVersionCleanupReport> {
        const dryRun = options?.dryRun === true
        const report: SecretVersionCleanupReport = {
            dryRun,
            numberOfSecretsCleared: 0,
            numberOfVersionsCleared: 0,
            numberOfErrors: 0,
            errors: [],
            plannedDestructions: []
        }
        const limiter = this.createCleanupLimiter()

        try {
            const secrets = await this.listAllSecrets(limiter)

            for (const secret of secrets) {
                const secretPath = secret.name
                if (!secretPath) {
                    report.numberOfErrors++
                    report.errors.push("Encountered a secret without a name")
                    continue
                }

                try {
                    const versions = await this.listAllSecretVersions(secretPath, limiter)
                    const enabledVersions = versions.filter(version => {
                        const versionNumber = this.extractVersionNumber(version.name)

                        return versionNumber !== null && this.isEnabledVersion(version.state) && !this.isDestroyedVersion(version.state)
                    })

                    if (enabledVersions.length <= 1) {
                        continue
                    }

                    const latestEnabledVersionNumber = Math.max(...enabledVersions.map(version => this.extractVersionNumber(version.name)!))

                    const versionsToDestroy = enabledVersions.filter(version => this.extractVersionNumber(version.name)! !== latestEnabledVersionNumber)

                    if (versionsToDestroy.length === 0) {
                        continue
                    }

                    report.plannedDestructions.push({
                        secretId: this.extractSecretId(secretPath),
                        secretPath,
                        versionNames: versionsToDestroy.map(version => version.name!).filter(Boolean),
                        latestEnabledVersionNumber
                    })

                    let destroyedForSecret = 0

                    for (const version of versionsToDestroy) {
                        if (!version.name) {
                            continue
                        }

                        if (dryRun) {
                            destroyedForSecret++
                            continue
                        }

                        try {
                            await this.runCleanupRequest(limiter, () => this.client.destroySecretVersion({ name: version.name! }))
                            destroyedForSecret++
                        } catch (error) {
                            report.numberOfErrors++
                            report.errors.push(`Failed to destroy ${version.name}: ${error instanceof Error ? error.message : "Unknown error"}`)
                            logger.warn("Failed to destroy old secret version", {
                                secretPath,
                                version: version.name,
                                error
                            })
                        }
                    }

                    if (destroyedForSecret > 0) {
                        report.numberOfSecretsCleared++
                        report.numberOfVersionsCleared += destroyedForSecret
                        logger.info(dryRun ? "Dry run identified old secret versions" : "Cleared old secret versions", {
                            secretId: this.extractSecretId(secretPath),
                            secretPath,
                            clearedVersions: destroyedForSecret,
                            latestEnabledVersionNumber,
                            dryRun
                        })
                    }
                } catch (error) {
                    report.numberOfErrors++
                    report.errors.push(`Failed to process ${secretPath}: ${error instanceof Error ? error.message : "Unknown error"}`)
                    logger.warn("Failed to clear old secret versions for secret", { secretPath, error })
                }
            }
        } catch (error) {
            report.numberOfErrors++
            report.errors.push(`Failed to list secrets: ${error instanceof Error ? error.message : "Unknown error"}`)
            logger.error("Failed to clear old secret versions", { error })
        }

        return report
    }

    /**
     * Creates a new secret or adds a new version
     */
    async createOrUpdateSecret(secretId: string, value: string): Promise<void> {
        const parent = this.getSecretPath(secretId)
        const payload = {
            data: Buffer.from(value, "utf-8")
        }

        try {
            await this.client.addSecretVersion({
                parent,
                payload
            })
            logger.debug("Stored secret version in Secret Manager", { secretId })
            return
        } catch (error) {
            if (!isGrpcError(error) || error.code !== GRPC_NOT_FOUND) {
                logger.error("Failed to store secret version in Secret Manager", { error, secretId })
                throw error
            }
        }

        await this.createSecretIfMissing(secretId)

        await this.client.addSecretVersion({
            parent,
            payload
        })
        logger.debug("Created secret then stored initial version in Secret Manager", { secretId })
    }

    async getSecret(secretId: string): Promise<string> {
        try {
            const [version] = await this.client.accessSecretVersion({
                name: this.getLatestSecretVersionPath(secretId)
            })

            const data = version.payload?.data
            if (!data) {
                throw new Error(`Secret payload missing for ${secretId}`)
            }

            if (typeof data === "string") {
                return data
            }

            return Buffer.from(data).toString("utf-8")
        } catch (error) {
            if (isSecretManagerNotFoundError(error)) {
                logger.debug("Secret not found in Secret Manager", { secretId })
                throw error
            }

            if (isSecretManagerDestroyedError(error)) {
                logger.warn("Secret version is in DESTROYED state in Secret Manager", { secretId })
                throw error
            }

            logger.error("Failed to read secret from Secret Manager", { error, secretId })
            throw error
        }
    }

    async getSecretOrNull(secretId: string): Promise<string | null> {
        try {
            return await this.getSecret(secretId)
        } catch (error) {
            if (isSecretManagerNotFoundError(error) || isSecretManagerDestroyedError(error)) {
                return null
            }
            throw error
        }
    }

    async deleteSecret(secretId: string): Promise<void> {
        try {
            await this.client.deleteSecret({
                name: this.getSecretPath(secretId)
            })
            logger.info("Deleted Secret Manager secret", { secretId })
        } catch (error) {
            if (isGrpcError(error) && error.code === GRPC_NOT_FOUND) {
                logger.debug("Secret already deleted or missing in Secret Manager", { secretId })
                return
            }

            logger.error("Failed to delete secret from Secret Manager", { error, secretId })
            throw error
        }
    }
}

function createSecretManagerClient(): SecretManagerClient {
    return new SecretManagerClient()
}

let secretManagerClient: SecretManagerClient | null = null

export function getSecretManagerClient(): SecretManagerClient {
    if (!secretManagerClient) {
        secretManagerClient = createSecretManagerClient()
    }
    return secretManagerClient
}
