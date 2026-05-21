import { db } from "../../loaders/prisma"

export async function findUserById(userId: string) {
    return db().users.findUnique({ where: { id: userId } })
}
