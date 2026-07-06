import { Request, Response } from "express"
import { apiTokenCreateRequestSchema, apiTokenUpdateRequestSchema } from "terse-types/types"

import { AnalyticsEvent, analytics } from "../../common/analytics"
import logger from "../../common/logger"

import { ApiTokenNotFoundError, createApiTokenForUser, deleteApiTokenForUser, listApiTokensForUser, updateApiTokenForUser } from "./service"

function handleError(error: unknown, res: Response, defaultMessage: string, logContext: Record<string, unknown>): Response | undefined {
    if (error instanceof ApiTokenNotFoundError) return res.status(404).json({ error: error.message })
    logger.error(defaultMessage, { error, ...logContext })
    return res.status(500).json({ error: defaultMessage })
}

export async function getApiTokens(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const { id: userId, organizationId } = req.session.user
    try {
        const response = await listApiTokensForUser(userId, organizationId)
        res.status(200).json(response)
    } catch (error) {
        return handleError(error, res, "Failed to fetch API tokens", { userId })
    }
}

export async function createApiToken(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const { id: userId, organizationId } = req.session.user
    const { name } = apiTokenCreateRequestSchema.parse(req.body)
    try {
        const response = await createApiTokenForUser(userId, organizationId, name)
        analytics.capture(userId, AnalyticsEvent.API_TOKEN_CREATED, { organizationId, tokenName: name })
        res.status(201).json(response)
    } catch (error) {
        return handleError(error, res, "Failed to create API token", { userId })
    }
}

export async function updateApiToken(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const { id: userId, organizationId } = req.session.user
    const tokenId = req.params.id
    const { name } = apiTokenUpdateRequestSchema.parse(req.body)
    try {
        const response = await updateApiTokenForUser(tokenId, userId, organizationId, name)
        res.status(200).json(response)
    } catch (error) {
        return handleError(error, res, "Failed to update API token", { userId, tokenId })
    }
}

export async function deleteApiToken(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const { id: userId, organizationId } = req.session.user
    const tokenId = req.params.id
    try {
        await deleteApiTokenForUser(tokenId, userId, organizationId)
        res.status(204).send()
    } catch (error) {
        return handleError(error, res, "Failed to delete API token", { userId, tokenId })
    }
}
