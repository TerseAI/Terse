import { users as PrismaUser } from "@prisma/client"

import { db } from "../../loaders/prisma"

export async function findUserByWorkosId(workosId: string): Promise<PrismaUser | null> {
    return db().users.findUnique({ where: { workos_id: workosId } })
}

export async function createUserWithDefaultNotifications(workosId: string): Promise<PrismaUser> {
    return db().users.create({
        data: {
            workos_id: workosId,
            notification_settings: {
                create: {
                    agent_default_notifications: ["error"],
                    weekly_agent_improvements: true
                }
            }
        }
    })
}
