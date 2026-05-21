import { Prisma } from "@prisma/client"

import { db } from "../../../loaders/prisma"
import { UserNotificationDestination, UserSlackIntegrationWithUser } from "../../../types/prisma"

export async function findDestinationsForUser(userId: string): Promise<UserNotificationDestination[]> {
    return db().user_notification_destinations.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" }
    })
}

export async function findDestinationById(destinationId: string, userId: string): Promise<UserNotificationDestination | null> {
    return db().user_notification_destinations.findFirst({
        where: { id: destinationId, user_id: userId }
    })
}

export async function createDestination(data: Prisma.user_notification_destinationsUncheckedCreateInput): Promise<UserNotificationDestination> {
    return db().user_notification_destinations.create({ data })
}

export async function updateDestination(destinationId: string, data: Prisma.user_notification_destinationsUpdateInput): Promise<UserNotificationDestination> {
    return db().user_notification_destinations.update({ where: { id: destinationId }, data })
}

export async function deleteDestination(destinationId: string): Promise<void> {
    await db().user_notification_destinations.delete({ where: { id: destinationId } })
}

export async function findSlackIntegrationForOrganization(integrationId: string, organizationId: string): Promise<UserSlackIntegrationWithUser | null> {
    return db().user_slack_integrations.findFirst({
        where: { id: integrationId, organization_id: organizationId },
        include: { user: true, slack_integration: true }
    })
}
