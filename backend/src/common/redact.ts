/**
 * Truncated string preview of an arbitrary value, for use in error logs that
 * would otherwise echo full upstream response bodies. Keeps enough context to
 * diagnose a 4xx without dumping vendor payloads (which may contain echoed
 * user content) into the log pipeline.
 */
export function previewError(value: unknown, maxLen = 200): string {
    const s = typeof value === "string" ? value : safeStringify(value)
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value)
    } catch {
        return String(value)
    }
}
