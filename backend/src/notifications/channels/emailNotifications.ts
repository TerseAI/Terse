import fs from "fs/promises"
import path from "path"
import { Resend } from "resend"
import { fileURLToPath } from "url"

import { settings } from "../../config/settings"
import { FrontendRoutes } from "../../shared/FrontendRoutes"
import { RunHistoryAction } from "../../shared/RunHistoryTypes"
import { User } from "../../shared/types"
import { Agent, UserNotificationDestination } from "../../types/prisma"
import { loadTemplate } from "../emails/templating"

const resend = new Resend(settings.resend.apiKey)
const notificationModuleDir = path.dirname(fileURLToPath(import.meta.url))
const inlineLogoCid = "terse-logo"
const fallbackLogoUrl = "https://app.useterse.ai/terse.png"
const inlineLogoPath = path.resolve(notificationModuleDir, "../emails/assets/terse-logo.png")

type EmailBranding = {
    logoSrc: string
    attachments?: Array<{
        filename: string
        content: string
        contentType: string
        contentId: string
    }>
}

async function getEmailBranding(): Promise<EmailBranding> {
    try {
        const logoContent = await fs.readFile(inlineLogoPath)

        return {
            logoSrc: `cid:${inlineLogoCid}`,
            attachments: [
                {
                    filename: "terse-logo.png",
                    content: logoContent.toString("base64"),
                    contentType: "image/png",
                    contentId: inlineLogoCid
                }
            ]
        }
    } catch {
        return { logoSrc: fallbackLogoUrl }
    }
}

function formatApprovalNotificationFor(action: string | undefined): string {
    if (!action || action.trim() === "") {
        return "Approval requested"
    }

    const cleanedAction = action.trim()
    if (/^approval requested for\b/i.test(cleanedAction)) {
        return cleanedAction
    }

    return `Approval requested for ${cleanedAction}`
}

export async function sendEmailNotification(notificationDestination: UserNotificationDestination, runAction: RunHistoryAction, agent: Agent) {
    const branding = await getEmailBranding()

    await resend.emails.send({
        from: settings.resend.fromEmail || "",
        to: notificationDestination.email_address || "",
        subject: "Notification from: " + agent.name,
        html: await loadTemplate("notification.html", { runAction, agent, logoSrc: branding.logoSrc }),
        attachments: branding.attachments
    })
}

export async function sendEmailApprovalRequest(notificationDestination: UserNotificationDestination, runId: string, runAction: RunHistoryAction, agent: Agent, user: User) {
    const runUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.AGENTS.RUN_HISTORY(agent.id, runId)}` : undefined
    const branding = await getEmailBranding()
    const notificationFor = formatApprovalNotificationFor(runAction.action)

    await resend.emails.send({
        from: settings.resend.fromEmail || "",
        to: notificationDestination.email_address || "",
        subject: agent.name + " is requesting your approval",
        html: await loadTemplate("approvalRequest.html", { runId, runAction, agent, user, runUrl, logoSrc: branding.logoSrc, notificationFor }),
        attachments: branding.attachments
    })
}

export async function sendEmailRunFailure(notificationDestination: UserNotificationDestination, agent: Agent, runId: string, errorMessage: string) {
    const runUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.AGENTS.RUN_HISTORY(agent.id, runId)}` : undefined
    const branding = await getEmailBranding()

    await resend.emails.send({
        from: settings.resend.fromEmail || "",
        to: notificationDestination.email_address || "",
        subject: "Error with Terse Agent: " + agent.name,
        html: await loadTemplate("runHistoryError.html", { agent, runId, errorMessage, runUrl, logoSrc: branding.logoSrc }),
        attachments: branding.attachments
    })
}
