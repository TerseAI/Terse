import { localDb } from "../../loaders/prisma"

import { decryptFromLocalStore, encryptForLocalStore } from "./localSecretEncryption"
import { SecretManagerClient } from "./SecretManagerClient"

export class LocalSecretManagerClient implements SecretManagerClient {
    async getSecretOrNull(blobId: string): Promise<string | null> {
        const row = await localDb().secret_blobs.findUnique({ where: { blob_id: blobId } })
        return row ? decryptFromLocalStore(row.data) : null
    }

    async createOrUpdateSecret(blobId: string, value: string): Promise<void> {
        const encrypted = encryptForLocalStore(value)
        await localDb().secret_blobs.upsert({
            where: { blob_id: blobId },
            create: { blob_id: blobId, data: encrypted },
            update: { data: encrypted }
        })
    }

    async deleteSecret(blobId: string): Promise<void> {
        await localDb()
            .secret_blobs.delete({ where: { blob_id: blobId } })
            .catch(() => {})
    }
}
