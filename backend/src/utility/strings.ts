import { randomBytes } from "node:crypto"

export const randomString = (length: number) => {
    return randomBytes(Math.ceil((length * 3) / 4))
        .toString("base64url")
        .slice(0, length)
}

export function extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export const isValidEpochTimestamp = (str: string): boolean => {
    const num = Number(str)
    if (isNaN(num) || num < 0) {
        return false
    }
    // Handle both Unix timestamps and Slack's decimal format (seconds.microseconds)
    let ms: number
    if (str.includes(".")) {
        // Slack format: seconds.microseconds - convert to milliseconds
        ms = num * 1000
    } else if (str.length === 10) {
        // Unix seconds (10 digits)
        ms = num * 1000
    } else {
        // Unix milliseconds (13+ digits)
        ms = num
    }
    const date = new Date(ms)
    return !isNaN(date.getTime()) && date.getFullYear() >= 1970 && date.getFullYear() <= 2100
}
