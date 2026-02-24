import axios from "axios"
import { randomUUID } from "crypto"

import logger from "../../../logger"

function getRandomBoundary(): string {
    return `mime_boundary_${randomUUID()}`
}

export function encodeSubjectHeader(subject: string): string {
    // Keep ASCII subjects unchanged; encode non-ASCII as RFC 2047 UTF-8 Base64 encoded-word.
    if (/^[\x00-\x7F]*$/.test(subject)) {
        return subject
    }
    return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`
}

export interface EmailAttachment {
    filename: string
    mimeType: string
    data: Buffer
}

function mimeTypeToExt(mimeType: string): string {
    const map: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
        "image/svg+xml": "svg"
    }
    return map[mimeType.toLowerCase()] ?? "png"
}

export async function downloadImageAttachments(imageUrls: string[]): Promise<EmailAttachment[]> {
    const results = await Promise.all(
        imageUrls.map(async (url, index): Promise<{ attachment: EmailAttachment; index: number } | null> => {
            try {
                const response = await axios.get(url, { responseType: "arraybuffer" })
                const mimeType = (response.headers["content-type"] as string | undefined)?.split(";")[0].trim() || "image/png"
                return {
                    attachment: { filename: "", mimeType, data: Buffer.from(response.data) },
                    index
                }
            } catch (error) {
                logger.warn("Failed to download image attachment for Gmail", { url, error })
                return null
            }
        })
    )
    // Use original image_urls indices for filenames so CID references (cid:image-1, cid:image-2, …)
    // in html_body stay correct even when some downloads fail.
    return results
        .filter((r): r is { attachment: EmailAttachment; index: number } => r !== null)
        .map(({ attachment, index }) => ({
            ...attachment,
            filename: `image-${index + 1}.${mimeTypeToExt(attachment.mimeType)}`
        }))
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

/**
 * Builds a multipart/related email so that inline images can be referenced via
 * cid:<filename> in the HTML body. Each attachment gets a Content-ID equal to
 * its filename (e.g. Content-ID: <screenshot.png>), allowing the AI to write
 * <img src="cid:screenshot.png"> in html_body.
 *
 * Falls back to multipart/mixed (no CID) when only a plain-text body is provided,
 * since cid: references are not supported in plain text.
 * Falls back to buildEmailContent when no attachments are provided.
 */
export function buildEmailContentWithAttachments(headers: string[], body: string | null | undefined, htmlBody: string | null | undefined, attachments: EmailAttachment[]): string {
    if (attachments.length === 0) {
        return buildEmailContent(headers, body, htmlBody)
    }

    const plainTextBody = body?.trim() ? body : null
    const htmlBodyContent = htmlBody?.trim() ? htmlBody : null

    // Without HTML there is nowhere to put cid: references — use multipart/mixed instead.
    if (!htmlBodyContent) {
        return buildMixedWithPlainText(headers, plainTextBody!, attachments)
    }

    return buildRelated(headers, plainTextBody, htmlBodyContent, attachments)
}

/**
 * multipart/related wrapping either a plain text/html pair (multipart/alternative)
 * or just HTML, followed by inline image parts with Content-ID headers.
 */
function buildRelated(headers: string[], plainTextBody: string | null, htmlBody: string, attachments: EmailAttachment[]): string {
    const outerBoundary = getRandomBoundary()

    const lines: string[] = [...headers, "MIME-Version: 1.0", `Content-Type: multipart/related; boundary="${outerBoundary}"`, "", `--${outerBoundary}`]

    // Body sub-part: multipart/alternative when we have both plain text and HTML.
    if (plainTextBody) {
        const innerBoundary = getRandomBoundary()
        lines.push(`Content-Type: multipart/alternative; boundary="${innerBoundary}"`)
        lines.push("")
        lines.push(`--${innerBoundary}`)
        lines.push('Content-Type: text/plain; charset="UTF-8"')
        lines.push("")
        lines.push(plainTextBody)
        lines.push("")
        lines.push(`--${innerBoundary}`)
        lines.push('Content-Type: text/html; charset="UTF-8"')
        lines.push("")
        lines.push(htmlBody)
        lines.push("")
        lines.push(`--${innerBoundary}--`)
    } else {
        lines.push('Content-Type: text/html; charset="UTF-8"')
        lines.push("")
        lines.push(htmlBody)
    }

    lines.push("")

    // Inline image parts — Content-ID is keyed on filename so the AI can predict it.
    for (const attachment of attachments) {
        const b64Data = attachment.data.toString("base64")
        const b64Lines = (b64Data.match(/.{1,76}/g) || [b64Data]).join("\r\n")
        lines.push(`--${outerBoundary}`)
        lines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`)
        lines.push("Content-Transfer-Encoding: base64")
        lines.push(`Content-ID: <${attachment.filename}>`)
        lines.push(`Content-Disposition: inline; filename="${attachment.filename}"`)
        lines.push("")
        lines.push(b64Lines)
        lines.push("")
    }

    lines.push(`--${outerBoundary}--`)
    return lines.join("\r\n")
}

/**
 * Fallback multipart/mixed for plain-text-only emails with attachments.
 * No CID references are possible here.
 */
function buildMixedWithPlainText(headers: string[], plainTextBody: string, attachments: EmailAttachment[]): string {
    const outerBoundary = getRandomBoundary()

    const lines: string[] = [
        ...headers,
        "MIME-Version: 1.0",
        `Content-Type: multipart/mixed; boundary="${outerBoundary}"`,
        "",
        `--${outerBoundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "",
        plainTextBody,
        ""
    ]

    for (const attachment of attachments) {
        const b64Data = attachment.data.toString("base64")
        const b64Lines = (b64Data.match(/.{1,76}/g) || [b64Data]).join("\r\n")
        lines.push(`--${outerBoundary}`)
        lines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`)
        lines.push("Content-Transfer-Encoding: base64")
        lines.push(`Content-Disposition: inline; filename="${attachment.filename}"`)
        lines.push("")
        lines.push(b64Lines)
        lines.push("")
    }

    lines.push(`--${outerBoundary}--`)
    return lines.join("\r\n")
}
