import crypto from "crypto"

export const randomString = (length: number) => {
    return Math.random()
        .toString(36)
        .substring(2, 2 + length)
}

export const MODEL_ITEM_ID_MAX_LENGTH = 64
export const MODEL_ITEM_ID_PATTERN = /^[A-Za-z0-9_-]+$/
export const MODEL_MESSAGE_ID_PREFIX = "msg_"

type SanitizeAndCapIdentifierOptions = {
    fallback?: string
    maxLength?: number
    hashLength?: number
}

export const sanitizeAndCapIdentifier = (value: string, options: SanitizeAndCapIdentifierOptions = {}): string => {
    const fallback = options.fallback ?? "unknown"
    const maxLength = options.maxLength ?? MODEL_ITEM_ID_MAX_LENGTH
    const hashLength = options.hashLength ?? 12

    const sanitized = value.trim().replace(/[^A-Za-z0-9_-]/g, "_")
    const base = sanitized || fallback

    if (base.length <= maxLength) {
        return base
    }

    if (maxLength <= 0) {
        return ""
    }

    if (maxLength <= hashLength + 1) {
        return crypto.createHash("md5").update(base, "utf8").digest("hex").slice(0, maxLength)
    }

    const hash = crypto.createHash("md5").update(base, "utf8").digest("hex").slice(0, hashLength)
    const prefixLength = maxLength - hash.length - 1
    return `${base.slice(0, prefixLength)}_${hash}`
}

export const sanitizeAndCapModelItemId = (value: string, fallback = "unknown"): string => {
    return sanitizeAndCapIdentifier(value, { fallback, maxLength: MODEL_ITEM_ID_MAX_LENGTH })
}

export const sanitizeAndCapModelMessageId = (value: string, fallback = "event"): string => {
    const maxBodyLength = Math.max(1, MODEL_ITEM_ID_MAX_LENGTH - MODEL_MESSAGE_ID_PREFIX.length)
    const withoutPrefix = value.trim().replace(/^msg_/, "")
    const body = sanitizeAndCapIdentifier(withoutPrefix, {
        fallback,
        maxLength: maxBodyLength
    })
    return `${MODEL_MESSAGE_ID_PREFIX}${body}`
}

let lastUnixMsForId = 0
let sameMsSequence = 0

/**
 * Generates an API-safe timestamp ID using only [A-Za-z0-9_-].
 * Format: "msg_<seconds>_<micros>".
 * Uses a per-process sequence to avoid collisions within the same millisecond.
 */
export const createUnixTimestampId = (): string => {
    const nowMs = Date.now()
    if (nowMs === lastUnixMsForId) {
        sameMsSequence = (sameMsSequence + 1) % 1000
    } else {
        lastUnixMsForId = nowMs
        sameMsSequence = 0
    }

    const seconds = Math.floor(nowMs / 1000)
    const micros = (nowMs % 1000) * 1000 + sameMsSequence
    return `msg_${seconds}_${String(micros).padStart(6, "0")}`
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
