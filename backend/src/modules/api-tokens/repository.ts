import { db } from "../../loaders/prisma"

export async function findUserApiToken(tokenId: string, userId: string, organizationId: string) {
    return db().api_tokens.findFirst({
        where: { id: tokenId, user_id: userId, organization_id: organizationId, kind: "USER" }
    })
}

export async function updateApiTokenName(tokenId: string, name: string) {
    return db().api_tokens.update({ where: { id: tokenId }, data: { name } })
}

export async function deleteApiTokenById(tokenId: string): Promise<void> {
    await db().api_tokens.delete({ where: { id: tokenId } })
}
