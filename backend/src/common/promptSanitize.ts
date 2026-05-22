const DEFAULT_MAX_LEN = 2000
const INJECTION_MARKER = /<\/?untrusted\b/i

export function wrapUntrusted(value: string | null | undefined, field: string, maxLen = DEFAULT_MAX_LEN): string {
    if (value === null || value === undefined) {
        return `<untrusted field="${field}"></untrusted>`
    }

    const stringValue = typeof value === "string" ? value : String(value)
    const stripped = stripControlChars(stringValue)
    const truncated = stripped.length > maxLen ? `${stripped.slice(0, maxLen)}…[truncated]` : stripped
    const neutralized = truncated.replace(/<\/?untrusted\b/gi, "<_untrusted_")

    return `<untrusted field="${field}">${neutralized}</untrusted>`
}

export function assertNoInjectionMarker(value: string, field: string): void {
    if (INJECTION_MARKER.test(value)) {
        throw new Error(`Sanitizer failed: field "${field}" still contains an untrusted-tag marker.`)
    }
}

function stripControlChars(value: string): string {
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
}
