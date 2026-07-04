import { randomBytes } from "node:crypto"

export const randomString = (length: number) => {
    return randomBytes(Math.ceil((length * 3) / 4))
        .toString("base64url")
        .slice(0, length)
}

export function extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    if (error && typeof error === "object") {
        return stringifyErrorObject(error)
    }
    return String(error)
}

function stringifyErrorObject(error: object): string {
    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

export const isValidEpochTimestamp = (str: string): boolean => {
    const num = Number(str)
    if (isNaN(num) || num < 0) {
        return false
    }
    let ms: number
    if (str.includes(".")) {
        ms = num * 1000
    } else if (str.length === 10) {
        ms = num * 1000
    } else {
        ms = num
    }
    const date = new Date(ms)
    return !isNaN(date.getTime()) && date.getFullYear() >= 1970 && date.getFullYear() <= 2100
}
