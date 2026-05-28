import logger from "../../common/logger"
import { localDb } from "../../loaders/prisma"

import { SecretManagerClient } from "./SecretManagerClient"
import { decryptFromLocalStore, encryptForLocalStore } from "./localSecretEncryption"

export class LocalSecretManagerClient implements SecretManagerClient {
    async getSecretOrNull(blobId: string): Promise<string | null> {
        const row = await localDb().secret_blobs.findUnique({ where: { blob_id: blobId } })
        logger.info("#LocalSecret get", { blobId, hit: row !== null })
        return row ? decryptFromLocalStore(row.data) : null
    }

    async createOrUpdateSecret(blobId: string, value: string): Promise<void> {
        const encrypted = encryptForLocalStore(value)
        await localDb().secret_blobs.upsert({
            where: { blob_id: blobId },
            create: { blob_id: blobId, data: encrypted },
            update: { data: encrypted }
        })
        logger.info("#LocalSecret upsert", { blobId })
    }

    async deleteSecret(blobId: string): Promise<void> {
        await localDb()
            .secret_blobs.delete({ where: { blob_id: blobId } })
            .catch(() => {})
        logger.info("#LocalSecret delete", { blobId })
    }
}
