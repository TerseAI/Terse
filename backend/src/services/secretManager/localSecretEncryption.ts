import fernet from "fernet"

import { settings } from "../../settings"

let cachedSecret: fernet.Secret | undefined

function secret(): fernet.Secret {
    if (cachedSecret) return cachedSecret
    const key = settings.local.secretsEncryptionKey
    if (!key) {
        throw new Error("LOCAL_SECRETS_ENCRYPTION_KEY is required for self-host secret storage. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"")
    }
    cachedSecret = new fernet.Secret(key)
    return cachedSecret
}

export function encryptForLocalStore(plaintext: string): string {
    return new fernet.Token({ secret: secret() }).encode(plaintext)
}

export function decryptFromLocalStore(token: string): string {
    return new fernet.Token({ secret: secret(), token, ttl: 0 }).decode()
}
