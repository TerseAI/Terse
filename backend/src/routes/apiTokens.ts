import { Request, Response } from "express"
import { apiTokensKey } from "terse-types/InvalidationKeys"
import { ApiToken } from "terse-types/types"
import { apiTokenCreateRequestSchema, apiTokenUpdateRequestSchema } from "terse-types/types"

import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithKey } from "../services/CacheInvalidationService"
import { createApiToken as createToken, getApiTokensForUser } from "../utility/apiTokens"
import { FeatureFlag, FeatureFlagService } from "../utility/featureFlags"

const API_TOKENS_INVALIDATION_KEY = apiTokensKey()[0]
const featureFlagService = FeatureFlagService.getInstance()

async function isSdkInterfaceEnabled(req: Request): Promise<boolean> {
    const user = req.session?.user
    if (!user) return false
    return featureFlagService.isFeatureFlagEnabled(FeatureFlag.SDK_INTERFACE, user.email, { email: user.email })
}

// GET /api-tokens
export async function getApiTokens(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    if (!(await isSdkInterfaceEnabled(req))) {
        res.status(403).json({ error: "SDK interface is not enabled for your account" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId

    try {
        const response = await getApiTokensForUser(userId, organizationId)
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

    if (!(await isSdkInterfaceEnabled(req))) {
        res.status(403).json({ error: "SDK interface is not enabled for your account" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const { name } = apiTokenCreateRequestSchema.parse(req.body)

    try {
        const response = await createToken(userId, organizationId, name)
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

    if (!(await isSdkInterfaceEnabled(req))) {
        res.status(403).json({ error: "SDK interface is not enabled for your account" })
        return
    }

    const userId = req.session.user.id
    const organizationId = req.session.user.organizationId
    const tokenId = req.params.id
    const { name } = apiTokenUpdateRequestSchema.parse(req.body)

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

    if (!(await isSdkInterfaceEnabled(req))) {
        res.status(403).json({ error: "SDK interface is not enabled for your account" })
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
