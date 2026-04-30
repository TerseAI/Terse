import { Request, Response } from "express"
import { billingCacheInvalidationBodySchema } from "terse-types"

import { emitBillingCachesInvalidated } from "../services/CacheInvalidationService"
import { verifyBillingServiceCallbackJwt } from "../services/billingJwt"

function bearerToken(req: Request): string | undefined {
    const raw = req.headers.authorization
    if (typeof raw !== "string") return undefined
    const match = raw.trim().match(/^Bearer\s+(.+)$/i)
    return match?.[1]?.trim()
}

export async function invalidateBillingCachesFromService(req: Request, res: Response) {
    const token = bearerToken(req)
    if (!token) {
        return res.status(401).json({ error: "Missing billing callback token" })
    }

    let claims: Awaited<ReturnType<typeof verifyBillingServiceCallbackJwt>>
    try {
        claims = await verifyBillingServiceCallbackJwt(token)
    } catch (error) {
        if (error instanceof Error && error.message.includes("BILLING_JWT_SECRET")) {
            return res.status(503).json({ error: "Billing callback auth is not configured" })
        }
        return res.status(401).json({ error: "Invalid billing callback token" })
    }
    const body = billingCacheInvalidationBodySchema.parse(req.body)
    if (claims.organizationId !== body.organizationId) {
        return res.status(403).json({ error: "Organization does not match authenticated billing callback" })
    }

    emitBillingCachesInvalidated(body.organizationId)
    return res.status(204).end()
}
