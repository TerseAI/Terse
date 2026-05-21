import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../utility/authMiddleware"

import { changeBillingSubscription, createBillingCheckoutSession, createBillingPortalSession, getBillingCatalog, getBillingContext, getBillingStatus, getBillingUsageBuckets } from "./controller"

const router = Router()

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { requireAdmin: true })
const limit = rateLimit(RateLimitKind.Default)

// Admin-only billing endpoints
router.post("/checkout-session", limit, auth, createBillingCheckoutSession)
router.post("/change", limit, auth, changeBillingSubscription)
router.post("/portal-session", limit, auth, createBillingPortalSession)
router.get("/context", limit, auth, getBillingContext)
router.get("/usage-buckets", limit, auth, getBillingUsageBuckets)
router.get("/catalog", limit, auth, getBillingCatalog)
router.get("/status", limit, auth, getBillingStatus)

export default router
