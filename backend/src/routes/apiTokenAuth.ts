import crypto from "crypto"
import { NextFunction, Request, Response } from "express"

import logger from "../logger"
import { db } from "../prismaClient"

/**
 * Middleware that authenticates requests using Bearer API tokens.
 *
 * - Hashes the incoming token with SHA-256 and looks up `api_tokens` by `token_hash`
 * - If found, populates `req.session` with the token owner's user data
 * - Fire-and-forget update to `last_used_at`
 * - If no Bearer header is present, passes through to existing session auth (non-breaking)
 *
 * This middleware is not wired to routes yet — it's ready for when SDK endpoints are built.
 */
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
            where: { token_hash: tokenHash },
            include: { user: true }
        })

        if (!apiToken) {
            res.status(401).json({ error: "Invalid API token" })
            return
        }

        // Populate session with the token owner's data
        req.session = {
            user: {
                id: apiToken.user.id,
                workosId: apiToken.user.workos_id,
                organizationId: apiToken.organization_id,
                organizationName: "",
                email: "",
                displayName: "",
                firstName: null,
                lastName: null,
                displayPhotoUrl: "",
                roles: []
            },
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
