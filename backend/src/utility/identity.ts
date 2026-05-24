import logger from "../common/logger"
import { db } from "../loaders/prisma"

/**
 * Delete every row across the schema that references a user. Stands in for
 * cascade-delete now that user_id has no FK constraint pointing anywhere.
 * Add a delete here whenever a new table grows a user_id column.
 */
export async function cleanupIdentity(workosUserId: string): Promise<void> {
    const prisma = db()
    try {
        await prisma.$transaction([
            prisma.api_tokens.deleteMany({ where: { user_id: workosUserId } }),
            prisma.attio_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.automations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.datadog_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.github_app_tokens.deleteMany({ where: { user_id: workosUserId } }),
            prisma.gmail_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.launchdarkly_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.linear_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.notion_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.posthog_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.snowflake_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.user_notification_destinations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.user_notification_settings.deleteMany({ where: { user_id: workosUserId } }),
            prisma.user_slack_integrations.deleteMany({ where: { user_id: workosUserId } }),
            prisma.workos_integrations.deleteMany({ where: { user_id: workosUserId } })
        ])
    } catch (error) {
        logger.error("cleanupIdentity failed", { workosUserId, error })
        throw error
    }
}
