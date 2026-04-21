import crypto from "crypto"
import { ApiToken, ApiTokenCreateResponse } from "terse-types/types"

import { db } from "../prismaClient"

export function hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex")
}

export function generateRawToken(): string {
    return `terse_${crypto.randomBytes(32).toString("hex")}`
}

export async function createApiToken(userId: string, organizationId: string, name: string): Promise<ApiTokenCreateResponse> {
    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)
    const tokenPrefix = rawToken.slice(0, 14)

    const token = await db().api_tokens.create({
        data: {
            user_id: userId,
            organization_id: organizationId,
            name: name.trim(),
            token_hash: tokenHash,
            token_prefix: tokenPrefix
        }
    })

    return {
        token: {
            id: token.id,
            name: token.name,
            tokenPrefix: token.token_prefix,
            createdAt: token.created_at.toISOString(),
            lastUsedAt: null
        },
        rawToken
    }
}

export async function createProjectScopedToken(params: {
    projectId: string
    projectName: string
    organizationId: string
    createdByUserId: string
}): Promise<{ rawToken: string; tokenId: string }> {
    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)
    const tokenPrefix = rawToken.slice(0, 14)

    const token = await db().api_tokens.create({
        data: {
            user_id: params.createdByUserId,
            organization_id: params.organizationId,
            project_id: params.projectId,
            name: `proj_${params.projectName}`,
            token_hash: tokenHash,
            token_prefix: tokenPrefix
        }
    })

    return { rawToken, tokenId: token.id }
}

export async function getApiTokensForUser(userId: string, organizationId: string): Promise<ApiToken[]> {
    const tokens = await db().api_tokens.findMany({
        where: { user_id: userId, organization_id: organizationId },
        orderBy: { created_at: "desc" }
    })

    return tokens.map(t => ({
        id: t.id,
        name: t.name,
        tokenPrefix: t.token_prefix,
        createdAt: t.created_at.toISOString(),
        lastUsedAt: t.last_used_at?.toISOString() ?? null
    }))
}
