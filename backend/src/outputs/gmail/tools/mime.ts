import { randomUUID } from "crypto"
import { encode as encodeRfc2047 } from "rfc2047"

function getRandomBoundary(): string {
    return `mime_boundary_${randomUUID()}`
}

export function encodeSubjectHeader(subject: string): string {
    return encodeRfc2047(subject)
}

function buildPlainTextMime(headers: string[], body: string): string {
    return [...headers, "MIME-Version: 1.0", 'Content-Type: text/plain; charset="UTF-8"', "", body].join("\r\n")
}

function buildHtmlMime(headers: string[], htmlBody: string): string {
    return [...headers, "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "", htmlBody].join("\r\n")
}

function buildMultipartAlternativeMime(headers: string[], body: string, htmlBody: string): string {
    const boundary = getRandomBoundary()
    return [
        ...headers,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "",
        body,
        "",
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        "",
        htmlBody,
        "",
        `--${boundary}--`
    ].join("\r\n")
}

export function buildEmailContent(headers: string[], body?: string | null, htmlBody?: string | null): string {
    const plainTextBody = body?.trim() ? body : null
    const htmlBodyContent = htmlBody?.trim() ? htmlBody : null

    if (plainTextBody && htmlBodyContent) {
        return buildMultipartAlternativeMime(headers, plainTextBody, htmlBodyContent)
    }

    if (htmlBodyContent) {
        return buildHtmlMime(headers, htmlBodyContent)
    }

    if (plainTextBody) {
        return buildPlainTextMime(headers, plainTextBody)
    }

    throw new Error("At least one of body or html_body is required")
}
