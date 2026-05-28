export interface SecretManagerClient {
    getSecretOrNull(blobId: string): Promise<string | null>
    createOrUpdateSecret(blobId: string, value: string): Promise<void>
    deleteSecret(blobId: string): Promise<void>
}
