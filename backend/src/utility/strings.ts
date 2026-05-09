export const randomString = (length: number) => {
    return Math.random()
        .toString(36)
        .substring(2, 2 + length)
}

export function extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export function extractErrorFields(error: unknown): Record<string, unknown> {
    if (!(error instanceof Error)) {
        return { errorName: typeof error, errorMessage: String(error) }
    }
    const fields: Record<string, unknown> = {
        errorName: error.name || error.constructor.name,
        errorMessage: error.message
    }
    const code = (error as { code?: unknown }).code
    if (code !== undefined) fields.errorCode = code
    const cause = (error as { cause?: unknown }).cause
    if (cause !== undefined) {
        fields.errorCause = cause instanceof Error ? cause.message : String(cause)
    }
    if (error.stack) {
        fields.errorStackHead = error.stack.split("\n").slice(0, 3).join("\n")
    }
    return fields
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
