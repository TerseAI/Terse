import { db } from "../../../loaders/prisma"

export async function countAndListSentNotifications(organizationId: string, skip: number, take: number) {
    const prisma = db()
    return prisma.$transaction([
        prisma.sent_notifications.count({ where: { organization_id: organizationId } }),
        prisma.sent_notifications.findMany({
            where: { organization_id: organizationId },
            orderBy: { sent_at: "desc" },
            skip,
            take
        })
    ])
}
