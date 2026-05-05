import crypto from "crypto"
import { NextFunction, Request, Response } from "express"

import logger from "../logger"
import { db } from "../prismaClient"
import { getUserForOrg } from "../utility/workos"

export async function apiTokenAuthMiddleware(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        next()
        return
    }

    const rawToken = authHeader.slice(7)
    if (!rawToken) {
        next()
        return
    }

    try {
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")

        const apiToken = await db().api_tokens.findUnique({
            where: { token_hash: tokenHash }
        })

        if (!apiToken) {
            res.status(401).json({ error: "Invalid API token" })
            return
        }

        const user = await getUserForOrg(apiToken.user_id, apiToken.organization_id)
        if (!user) {
            logger.warn("API token references a user/org that no longer resolves; rejecting", {
                tokenId: apiToken.id,
                userId: apiToken.user_id,
                organizationId: apiToken.organization_id
            })
            res.status(401).json({ error: "API token is no longer valid for this organization" })
            return
        }

        req.session = {
            user,
            isUserInitiated: false
        }

        // Fire-and-forget update to last_used_at
        db()
            .api_tokens.update({
                where: { id: apiToken.id },
                data: { last_used_at: new Date() }
            })
            .catch(err => {
                logger.warn("Failed to update api_token last_used_at", { error: err, tokenId: apiToken.id })
            })

        next()
    } catch (error) {
        logger.error("Error in API token auth middleware", { error })
        res.status(500).json({ error: "Authentication failed" })
    }
}
