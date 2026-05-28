import logger from "../../common/logger"

import EmailProvider, { SendEmailInput } from "./EmailProvider"

/**
 * Fallback used when no email provider is configured. Logs each send attempt
 * so self-hosters can see what *would* have been sent, but never delivers.
 * Set RESEND_API_KEY (or wire up an SMTP provider) to enable real delivery.
 */
export class NoOpEmailProvider implements EmailProvider {
    readonly isAvailable = false

    async sendEmail(input: SendEmailInput): Promise<void> {
        logger.info("[NoOpEmailProvider] Email not sent (no email provider configured)", {
            to: input.to,
            subject: input.subject
        })
    }
}
