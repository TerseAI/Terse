import { Router } from "express"

import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { createOrUpdateHeyReachIntegration, getHeyReachCampaigns, getHeyReachIntegrations } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getHeyReachIntegrations)
router.post("/integrations", limit, auth, createOrUpdateHeyReachIntegration)
router.get("/campaigns", limit, auth, getHeyReachCampaigns)

export default router
