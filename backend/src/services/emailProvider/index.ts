import logger from "../../common/logger"
import { settings } from "../../settings"

import EmailProvider from "./EmailProvider"
import { NoOpEmailProvider } from "./NoOpEmailProvider"
import { ResendEmailProvider } from "./ResendEmailProvider"

const emailProvider: EmailProvider = (() => {
    if (settings.resend) {
        logger.info("Using email provider: resend")
        return new ResendEmailProvider()
    }
    logger.warn("No email provider configured — emails will not be sent. Set RESEND_API_KEY to enable.")
    return new NoOpEmailProvider()
})()

export function getEmailProvider(): EmailProvider {
    return emailProvider
}
