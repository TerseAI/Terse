const DEFAULT_MAX_LEN = 2000
const INJECTION_MARKER = /<\/?untrusted\b/i

/**
 * Wraps a free-form, third-party-controlled string in <untrusted field="..."> tags
 * so a downstream LLM treats it as data, not instructions. Strips ASCII control
 * characters (so attackers cannot reset terminal state or hide payloads), and
 * truncates to maxLen to bound prompt size.
 *
 * Any literal <untrusted> opener or closer inside the value is neutralized so
 * the attacker cannot break out of the wrapper.
 */
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

/**
 * Throws if the value contains a literal `<untrusted` or `</untrusted` substring.
 * Used to assert sanitizer invariants in regression tests.
 */
export function assertNoInjectionMarker(value: string, field: string): void {
    if (INJECTION_MARKER.test(value)) {
        throw new Error(`Sanitizer failed: field "${field}" still contains an untrusted-tag marker.`)
    }
}

function stripControlChars(value: string): string {
    // Allow \t (0x09), \n (0x0A), \r (0x0D); strip the rest of the C0 range and DEL.
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
}
