import { TokenKind } from "@prisma/client"
import crypto from "crypto"
import { ApiToken, ApiTokenCreateResponse } from "terse-types/types"

import { db } from "../prismaClient"
import { PrismaTransaction } from "../types/prisma"

export function hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex")
}

function generateRawToken(): string {
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
            token_prefix: tokenPrefix,
            kind: TokenKind.USER
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

export async function createProjectScopedToken(
    params: { projectId: string; projectName: string; organizationId: string; createdByUserId: string },
    tx?: PrismaTransaction
): Promise<{ rawToken: string; tokenId: string }> {
    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)
    const tokenPrefix = rawToken.slice(0, 14)

    const client = tx ?? db()
    const token = await client.api_tokens.create({
        data: {
            user_id: params.createdByUserId,
            organization_id: params.organizationId,
            project_id: params.projectId,
            name: `proj_${params.projectName}`,
            token_hash: tokenHash,
            token_prefix: tokenPrefix,
            kind: TokenKind.PROJECT
        }
    })

    return { rawToken, tokenId: token.id }
}

const SANDBOX_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export async function createSandboxToken(params: { userId: string; organizationId: string; projectId: string }): Promise<{ rawToken: string; tokenId: string }> {
    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)
    const tokenPrefix = rawToken.slice(0, 14)

    const token = await db().api_tokens.create({
        data: {
            user_id: params.userId,
            organization_id: params.organizationId,
            project_id: params.projectId,
            name: "sdk-sandbox-runner",
            token_hash: tokenHash,
            token_prefix: tokenPrefix,
            kind: TokenKind.PROJECT,
            expires_at: new Date(Date.now() + SANDBOX_TOKEN_TTL_MS)
        }
    })

    return { rawToken, tokenId: token.id }
}

export async function getApiTokensForUser(userId: string, organizationId: string): Promise<ApiToken[]> {
    const tokens = await db().api_tokens.findMany({
        where: { user_id: userId, organization_id: organizationId, kind: TokenKind.USER },
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

export async function deleteExpiredApiTokens(): Promise<number> {
    const result = await db().api_tokens.deleteMany({
        where: {
            expires_at: { not: null, lt: new Date() }
        }
    })
    return result.count
}
