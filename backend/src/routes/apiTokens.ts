import crypto from "crypto"
import { Request, Response } from "express"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../services/CacheInvalidationService"
import { apiTokensKey } from "../shared/InvalidationKeys"
import { ApiToken, ApiTokenCreateResponse } from "../shared/types"

const API_TOKENS_INVALIDATION_KEY = apiTokensKey()[0]

function hashToken(rawToken: string): string {
    return crypto.createHash("sha256").update(rawToken).digest("hex")
}

function generateRawToken(): string {
    return `terse_${crypto.randomBytes(32).toString("hex")}`
}

// GET /api-tokens
export async function getApiTokens(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId

    try {
        const tokens = await db().api_tokens.findMany({
            where: { user_id: userId, organization_id: organizationId },
            orderBy: { created_at: "desc" }
        })

        const response: ApiToken[] = tokens.map(t => ({
            id: t.id,
            name: t.name,
            tokenPrefix: t.token_prefix,
            createdAt: t.created_at.toISOString(),
            lastUsedAt: t.last_used_at?.toISOString() ?? null
        }))

        res.status(200).json(response)
    } catch (error) {
        logger.error("Error fetching API tokens", { error, userId })
        res.status(500).json({ error: "Failed to fetch API tokens" })
    }
}

// POST /api-tokens
export async function createApiToken(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const { name } = req.body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Token name is required" })
        return
    }

    if (name.trim().length > 100) {
        res.status(400).json({ error: "Token name must be 100 characters or less" })
        return
    }

    try {
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

        const response: ApiTokenCreateResponse = {
            token: {
                id: token.id,
                name: token.name,
                tokenPrefix: token.token_prefix,
                createdAt: token.created_at.toISOString(),
                lastUsedAt: null
            },
            rawToken
        }

        invalidateApiTokens(organizationId)
        res.status(201).json(response)
    } catch (error) {
        logger.error("Error creating API token", { error, userId })
        res.status(500).json({ error: "Failed to create API token" })
    }
}

// PATCH /api-tokens/:id
export async function updateApiToken(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const tokenId = req.params.id
    const { name } = req.body

    if (!name || typeof name !== "string" || name.trim().length === 0) {
        res.status(400).json({ error: "Token name is required" })
        return
    }

    if (name.trim().length > 100) {
        res.status(400).json({ error: "Token name must be 100 characters or less" })
        return
    }

    try {
        const existing = await db().api_tokens.findFirst({
            where: { id: tokenId, user_id: userId, organization_id: organizationId }
        })

        if (!existing) {
            res.status(404).json({ error: "API token not found" })
            return
        }

        const updated = await db().api_tokens.update({
            where: { id: tokenId },
            data: { name: name.trim() }
        })

        const response: ApiToken = {
            id: updated.id,
            name: updated.name,
            tokenPrefix: updated.token_prefix,
            createdAt: updated.created_at.toISOString(),
            lastUsedAt: updated.last_used_at?.toISOString() ?? null
        }

        invalidateApiTokens(organizationId)
        res.status(200).json(response)
    } catch (error) {
        logger.error("Error updating API token", { error, userId, tokenId })
        res.status(500).json({ error: "Failed to update API token" })
    }
}

// DELETE /api-tokens/:id
export async function deleteApiToken(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const tokenId = req.params.id

    try {
        const existing = await db().api_tokens.findFirst({
            where: { id: tokenId, user_id: userId, organization_id: organizationId }
        })

        if (!existing) {
            res.status(404).json({ error: "API token not found" })
            return
        }

        await db().api_tokens.delete({ where: { id: tokenId } })

        invalidateApiTokens(organizationId)
        res.status(204).send()
    } catch (error) {
        logger.error("Error deleting API token", { error, userId, tokenId })
        res.status(500).json({ error: "Failed to delete API token" })
    }
}

function invalidateApiTokens(organizationId: string | null | undefined): void {
    if (!organizationId) return
    emitCacheInvalidationWithKey(organizationId, API_TOKENS_INVALIDATION_KEY)
}
