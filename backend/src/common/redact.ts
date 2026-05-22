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
