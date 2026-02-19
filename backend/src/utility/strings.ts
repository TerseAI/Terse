export const randomString = (length: number) => {
    return Math.random()
        .toString(36)
        .substring(2, 2 + length)
}

let lastUnixMsForId = 0
let sameMsSequence = 0

/**
 * Generates a Unix timestamp ID in Slack-like format: "seconds.microseconds".
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
    return `${seconds}.${String(micros).padStart(6, "0")}`
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
