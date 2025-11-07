import crypto from 'crypto';

/**
 * Generates a secure random string for webhook secrets/passcodes.
 * Uses cryptographically secure random bytes.
 * 
 * @param length - Number of bytes to generate (default: 32, which produces 64 hex characters)
 * @returns Hex-encoded random string
 */
export function generateWebhookSecret(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generates a secure passcode for webhook verification.
 * Shorter than full secrets, suitable for webhook passcodes.
 * 
 * @param length - Number of bytes to generate (default: 16, which produces 32 hex characters)
 * @returns Hex-encoded random string
 */
export function generateWebhookPasscode(length: number = 16): string {
    return crypto.randomBytes(length).toString('hex');
}

