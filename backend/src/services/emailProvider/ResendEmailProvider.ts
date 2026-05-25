import { Resend } from "resend"

import logger from "../../common/logger"
import { extractErrorMessage } from "../../common/strings"
import { SettingsDependant } from "../../settings"

import EmailProvider, { SendEmailInput } from "./EmailProvider"

export class ResendEmailProvider extends SettingsDependant implements EmailProvider {
    readonly settingsKey = "resend"

    readonly resend = new Resend(this.config.apiKey)

    private get fromAddress(): string {
        const fromEmail = this.config.fromEmail
        return fromEmail ? `Terse <${fromEmail}>` : ""
    }

    async sendEmail(input: SendEmailInput): Promise<void> {
        try {
            await this.resend.emails.send({
                from: this.fromAddress,
                to: input.to,
                subject: input.subject,
                html: input.html,
                attachments: input.attachments
            })
        } catch (error) {
            logger.error("[ResendEmailProvider] sendEmail failed", { error: extractErrorMessage(error), to: input.to, subject: input.subject })
            throw error
        }
    }
}
