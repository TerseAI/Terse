import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { invalidateBillingCachesFromService } from "./controller"

// Mounted at root from server.ts — uses BillingService JWT, not AuthKind middleware.
const router = Router()
router.post("/billing/cache-invalidation", rateLimit(RateLimitKind.WebhookByIp), invalidateBillingCachesFromService)

export default router
