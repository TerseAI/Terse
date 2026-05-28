export interface EmailAttachment {
    filename: string
    /** Base64-encoded content. */
    content: string
    contentType: string
    contentId: string
}

export interface SendEmailInput {
    to: string
    subject: string
    html: string
    attachments?: EmailAttachment[]
}

/**
 * Transport-agnostic email sender. Each implementation knows its own `from`
 * address and credentials; callers just supply recipient + content.
 */
export interface EmailProvider {
    readonly isAvailable: boolean
    sendEmail(input: SendEmailInput): Promise<void>
}

export default EmailProvider
