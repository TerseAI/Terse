import { SecretManagerServiceClient } from "@google-cloud/secret-manager"

import { gcp } from "../config/settings"
import logger from "../logger"

const GRPC_NOT_FOUND = 5
const GRPC_ALREADY_EXISTS = 6

interface GrpcError {
    code?: number
    message?: string
}

function isGrpcError(error: unknown): error is GrpcError {
    return typeof error === "object" && error !== null && "code" in error
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
            if (isGrpcError(error) && error.code === GRPC_NOT_FOUND) {
                logger.debug("Secret not found in Secret Manager", { secretId })
                throw error
            }

            logger.error("Failed to read secret from Secret Manager", { error, secretId })
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

export function createSecretManagerClient(): SecretManagerClient {
    return new SecretManagerClient()
}

let secretManagerClient: SecretManagerClient | null = null

export function getSecretManagerClient(): SecretManagerClient {
    if (!secretManagerClient) {
        secretManagerClient = createSecretManagerClient()
    }
    return secretManagerClient
}
