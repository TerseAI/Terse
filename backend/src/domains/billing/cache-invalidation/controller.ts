import { Request, Response } from "express"
import { billingCacheInvalidationBodySchema } from "terse-types"

import { readBearerToken } from "../../../domains/auth/helpers/authDispatch"
import { emitBillingCachesInvalidated } from "../../../services/CacheInvalidationService"
import { verifyBillingServiceCallbackJwt } from "../../../services/billingJwt"

export async function invalidateBillingCachesFromService(req: Request, res: Response) {
    const token = readBearerToken(req.headers.authorization)
    if (!token) return res.status(401).json({ error: "Missing billing callback token" })

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
