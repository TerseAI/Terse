import fs from "fs/promises"
import path from "path"
import { FrontendRoutes, buildRoute } from "terse-types"
import { RunHistoryAction } from "terse-types"
import { UserSession } from "terse-types"
import { fileURLToPath } from "url"

import { FailureState } from "../../../modules/agents/AgentRunner/runHistory"
import { getEmailProvider } from "../../../services/emailProvider"
import { settings } from "../../../settings"
import { Agent, UserNotificationDestination } from "../../../types/prisma"
import { loadTemplate } from "../emails/templating"
import { formatApprovalNotificationFor } from "../utils"

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

export async function sendEmailNotification(notificationDestination: UserNotificationDestination, runAction: RunHistoryAction, agent: Agent) {
    const agentSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.ALERTS, { id: agent.id })}` : undefined
    const notificationSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.NOTIFICATIONS}` : undefined
    const branding = await getEmailBranding()

    await getEmailProvider().sendEmail({
        to: notificationDestination.email_address || "",
        subject: "Notification from: " + agent.name,
        html: await loadTemplate("notification.html", { runAction, agent, logoSrc: branding.logoSrc, agentSettingsUrl, notificationSettingsUrl }),
        attachments: branding.attachments
    })
}

export async function sendEmailApprovalRequest(notificationDestination: UserNotificationDestination, runId: string, runAction: RunHistoryAction, agent: Agent, user: UserSession) {
    const runUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.RUN_HISTORY, { id: agent.id, runId })}` : undefined
    const agentSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.ALERTS, { id: agent.id })}` : undefined
    const notificationSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.NOTIFICATIONS}` : undefined
    const branding = await getEmailBranding()
    const notificationFor = formatApprovalNotificationFor(runAction.action)

    await getEmailProvider().sendEmail({
        to: notificationDestination.email_address || "",
        subject: agent.name + " is requesting your approval",
        html: await loadTemplate("approvalRequest.html", { runId, runAction, agent, user, runUrl, logoSrc: branding.logoSrc, notificationFor, agentSettingsUrl, notificationSettingsUrl }),
        attachments: branding.attachments
    })
}

export async function sendEmailRunFailure(notificationDestination: UserNotificationDestination, agent: Agent, runId: string, errorMessage: string, failureState: FailureState) {
    const runUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.RUN_HISTORY, { id: agent.id, runId })}` : undefined
    const agentSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${buildRoute(FrontendRoutes.AGENTS.ALERTS, { id: agent.id })}` : undefined
    const notificationSettingsUrl = settings.urls.frontend ? `${settings.urls.frontend}${FrontendRoutes.NOTIFICATIONS}` : undefined
    const branding = await getEmailBranding()

    let subject: string
    switch (failureState.tier) {
        case "paused":
            subject = `Terse Agent paused: ${agent.name}`
            break
        case "warning":
            subject = `Repeated error with Terse Agent: ${agent.name}`
            break
        default:
            subject = `Error with Terse Agent: ${agent.name}`
            break
    }

    await getEmailProvider().sendEmail({
        to: notificationDestination.email_address || "",
        subject,
        html: await loadTemplate("runHistoryError.html", {
            agent,
            runId,
            errorMessage,
            runUrl,
            logoSrc: branding.logoSrc,
            agentSettingsUrl,
            notificationSettingsUrl,
            failureState,
            isWarning: failureState.tier === "warning",
            isPaused: failureState.tier === "paused"
        }),
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

    await getEmailProvider().sendEmail({
        to: emailAddress,
        subject: "Weekly Agent Review",
        html: await loadTemplate("weeklyReview.html", { agents, logoSrc: branding.logoSrc, notificationSettingsUrl }),
        attachments: branding.attachments
    })
}

// ─────────── helpers ───────────

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
