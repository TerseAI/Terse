import crypto from "crypto"

/**
 * Generates a secure random string for webhook secrets/passcodes.
 * Uses cryptographically secure random bytes.
 *
 * @param length - Number of bytes to generate (default: 32, which produces 64 hex characters)
 * @returns Hex-encoded random string
 */
export function generateWebhookSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex")
}
