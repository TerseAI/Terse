import fs from "fs/promises"
import path from "path"
import { Resend } from "resend"
import { FrontendRoutes, buildRoute } from "terse-types"
import { RunHistoryAction } from "terse-types"
import { User } from "terse-types"
import { fileURLToPath } from "url"

import { settings } from "../../config/settings"
import { Agent, UserNotificationDestination } from "../../types/prisma"
import { loadTemplate } from "../emails/templating"
import { formatApprovalNotificationFor } from "../utils"

const resend = new Resend(settings.resend.apiKey)
const notificationModuleDir = path.dirname(fileURLToPath(import.meta.url))
const inlineLogoCid = "terse-logo"
const fallbackLogoUrl = "https://app.useterse.ai/terse.png"
const inlineLogoPath = path.resolve(notificationModuleDir, "../emails/assets/terse-logo.png")
const fromEmail = settings.resend.fromEmail ? `Terse <${settings.resend.fromEmail}>` : ""

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

export async function sendEmailNotification(notificationDestination: UserNotificationDestination, runAction: RunHistoryAction, agent: Agent) {
    const agentSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.ALERTS, { id: agent.id })}` : undefined
    const notificationSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.NOTIFICATIONS}` : undefined
    const branding = await getEmailBranding()

    await resend.emails.send({
        from: fromEmail,
        to: notificationDestination.email_address || "",
        subject: "Notification from: " + agent.name,
        html: await loadTemplate("notification.html", { runAction, agent, logoSrc: branding.logoSrc, agentSettingsUrl, notificationSettingsUrl }),
        attachments: branding.attachments
    })
}

export async function sendEmailApprovalRequest(notificationDestination: UserNotificationDestination, runId: string, runAction: RunHistoryAction, agent: Agent, user: User) {
    const runUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.RUN_HISTORY, { id: agent.id, runId })}` : undefined
    const agentSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.ALERTS, { id: agent.id })}` : undefined
    const notificationSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.NOTIFICATIONS}` : undefined
    const branding = await getEmailBranding()
    const notificationFor = formatApprovalNotificationFor(runAction.action)

    await resend.emails.send({
        from: fromEmail,
        to: notificationDestination.email_address || "",
        subject: agent.name + " is requesting your approval",
        html: await loadTemplate("approvalRequest.html", { runId, runAction, agent, user, runUrl, logoSrc: branding.logoSrc, notificationFor, agentSettingsUrl, notificationSettingsUrl }),
        attachments: branding.attachments
    })
}

export async function sendEmailRunFailure(notificationDestination: UserNotificationDestination, agent: Agent, runId: string, errorMessage: string) {
    const runUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.RUN_HISTORY, { id: agent.id, runId })}` : undefined
    const agentSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.ALERTS, { id: agent.id })}` : undefined
    const notificationSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.NOTIFICATIONS}` : undefined
    const branding = await getEmailBranding()

    await resend.emails.send({
        from: fromEmail,
        to: notificationDestination.email_address || "",
        subject: "Error with Terse Agent: " + agent.name,
        html: await loadTemplate("runHistoryError.html", { agent, runId, errorMessage, runUrl, logoSrc: branding.logoSrc, agentSettingsUrl, notificationSettingsUrl }),
        attachments: branding.attachments
    })
}

export async function sendBillingThresholdEmail(emailAddress: string, subject: string, body: string) {
    const branding = await getEmailBranding()
    const escapedBody = body
        .split("\n")
        .map(line => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
        .join("<br />")

    await resend.emails.send({
        from: fromEmail,
        to: emailAddress,
        subject,
        html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.5; color: #111827;">
                <img src="${branding.logoSrc}" alt="Terse" style="height: 28px; margin-bottom: 24px;" />
                <h1 style="font-size: 20px; margin: 0 0 12px;">${subject.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h1>
                <p style="font-size: 14px; margin: 0;">${escapedBody}</p>
            </div>
        `,
        attachments: branding.attachments
    })
}

export async function sendWeeklyReviewEmail(
    emailAddress: string,
    agents: Array<{
        name: string
        improvements: Array<{ title: string }>
        improvementsUrl: string
    }>
): Promise<void> {
    const branding = await getEmailBranding()

    const notificationSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.NOTIFICATIONS}` : undefined

    await resend.emails.send({
        from: fromEmail,
        to: emailAddress,
        subject: "Weekly Agent Review",
        html: await loadTemplate("weeklyReview.html", { agents, logoSrc: branding.logoSrc, notificationSettingsUrl }),
        attachments: branding.attachments
    })
}
