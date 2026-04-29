import { NotificationDestinationType } from "@prisma/client"
import { FrontendRoutes } from "terse-types"

import { settings } from "../config/settings"
import logger from "../logger"
import { sendBillingThresholdEmail } from "../notifications/channels/emailNotifications"
import { db } from "../prismaClient"
import { resolveSlackChannelIdForDestination, sendSlackMessage } from "../utility/slack"

import type { ThresholdEvent } from "./BillingNotifications"

export async function sendBillingThresholdNotification(orgId: string, event: ThresholdEvent): Promise<void> {
    const destinations = await db().user_notification_destinations.findMany({
        where: {
            is_active: true,
            user: {
                OR: [
                    { automations: { some: { organization_id: orgId } } },
                    { api_tokens: { some: { organization_id: orgId } } },
                    { user_slack_integrations: { some: { organization_id: orgId } } },
                    { linear_integrations: { some: { organization_id: orgId } } },
                    { gmail_integrations: { some: { organization_id: orgId } } },
                    { notion_integrations: { some: { organization_id: orgId } } },
                    { github_app_tokens: { some: { organization_id: orgId } } },
                    { posthog_integrations: { some: { organization_id: orgId } } },
                    { launchdarkly_integrations: { some: { organization_id: orgId } } },
                    { datadog_integrations: { some: { organization_id: orgId } } },
                    { workos_integrations: { some: { organization_id: orgId } } },
                    { attio_integrations: { some: { organization_id: orgId } } },
                    { snowflake_integrations: { some: { organization_id: orgId } } }
                ]
            }
        }
    })

    if (destinations.length === 0) {
        logger.info("No active notification destinations for billing threshold", { orgId, threshold: event.threshold })
        return
    }

    const subject = subjectFor(event)
    const body = bodyFor(event)

    await Promise.all(
        destinations.map(async destination => {
            if (destination.destination_type === NotificationDestinationType.EMAIL && destination.email_address) {
                await sendBillingThresholdEmail(destination.email_address, subject, body)
                return
            }

            if (destination.destination_type === NotificationDestinationType.SLACK && destination.slack_integration_id) {
                const channelId = await resolveSlackChannelIdForDestination(destination.slack_integration_id, destination.slack_channel_id, destination.slack_user_id)
                if (!channelId) return
                await sendSlackMessage(destination.slack_integration_id, channelId, {
                    text: `${subject}\n${body}`
                })
            }
        })
    )
}

function subjectFor(event: ThresholdEvent): string {
    switch (event.threshold) {
        case 75:
            return "You've used 75% of your Terse credits this month"
        case 90:
            return "You've used 90% of your Terse credits this month"
        case 100:
            return event.overageMode === "soft" ? "You're now in overage billing" : "Your Terse automations are paused: credit limit reached"
        case 200:
            return "Your Terse automations are paused: hard cap reached"
    }
}

function bodyFor(event: ThresholdEvent): string {
    const pct = event.threshold === 200 ? "200%" : `${event.threshold}%`
    const billingUrl = `${settings.urls.frontend ?? ""}${FrontendRoutes.BILLING}`
    return `${pct} of your monthly credit allowance has been consumed (${event.consumedCredits.toLocaleString()} of ${event.includedCredits.toLocaleString()} credits).\nUpgrade or buy a top-up at ${billingUrl}.`
}
