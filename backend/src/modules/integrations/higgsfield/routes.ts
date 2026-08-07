import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../auth/helpers/authMiddleware"

import { createOrUpdateHiggsfieldIntegration, getHiggsfieldIntegrations } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getHiggsfieldIntegrations)
router.post("/integrations", limit, auth, createOrUpdateHiggsfieldIntegration)

export default router
