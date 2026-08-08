/**
 * GitHub Code Search query sanitizers.
 *
 * The admin-configured repository allowlist is enforced by appending
 * `repo:<allowed>` qualifiers to the final query string. GitHub treats
 * multiple `repo:` qualifiers as a logical OR, so anything the agent can
 * smuggle into the user-controlled portion of the query escapes the
 * allowlist. These helpers strip the smuggling vector before the query
 * reaches the GitHub client.
 */

// Tokens of the form `<qualifier>:` are special to GitHub's Code Search.
// We block the ones an attacker could use to expand the search outside the
// admin-configured repos. Use a word boundary so qualifiers preceded by any
// non-word character — parens, quotes, brackets, etc. — are also caught,
// since GitHub's Code Search treats those as token boundaries (e.g.
// `(repo:other/secret)` parses `repo:` as a real qualifier).
const DISALLOWED_SEARCH_QUALIFIERS = ["repo", "user", "org", "in", "fork", "language", "extension", "filename", "path", "topic", "size", "created", "pushed", "archived", "is", "license"]

const QUALIFIER_INJECTION_PATTERN = new RegExp(`\\b(?:${DISALLOWED_SEARCH_QUALIFIERS.join("|")}):`, "i")

export function assertNoSearchQualifiers(value: string, fieldName: string): void {
    if (QUALIFIER_INJECTION_PATTERN.test(value)) {
        throw new Error(`Invalid \`${fieldName}\` argument: GitHub search qualifiers (e.g. \`repo:\`, \`user:\`, \`path:\`) are not allowed.`)
    }
}

// Scalar GitHub search qualifier values (language, filename, extension, path).
// These get concatenated into the query as `<qualifier>:<value>` — any
// whitespace, colon, or quote character lets an attacker break out and
// append a fresh qualifier.
export function assertSimpleQualifierValue(value: string | null | undefined, fieldName: string): string | null | undefined {
    if (value === undefined || value === null || value.length === 0) return value
    if (/[\s:"'`\\]/.test(value)) {
        throw new Error(`Invalid \`${fieldName}\` argument: must not contain whitespace, colons, or quote characters.`)
    }
    return value
}

// Quote-wrap a free-text grep pattern so GitHub treats it as a single
// literal token. Strips any interior quote/backslash characters so the
// wrapping cannot be broken.
export function quoteGrepPattern(pattern: string): string {
    return quoteQualifierValue(pattern)
}

// Quote-wrap a qualifier value that may legitimately contain spaces
// (e.g. `label:"needs triage"`). Interior quote/backslash characters are
// stripped so the wrapping cannot be broken out of.
export function quoteQualifierValue(value: string): string {
    const stripped = value.replace(/["\\]/g, "")
    return `"${stripped}"`
}
