import { Router } from "express"

import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { createOrUpdateDatadogIntegration, getDatadogIndexes, getDatadogIntegrations } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getDatadogIntegrations)
router.post("/integrations", limit, auth, createOrUpdateDatadogIntegration)
router.get("/indexes", limit, auth, getDatadogIndexes)

export default router
