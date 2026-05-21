import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { createOrUpdateHeyReachIntegration, getHeyReachCampaigns, getHeyReachIntegrations } from "../../../routes/heyreach"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getHeyReachIntegrations)
router.post("/integrations", limit, auth, createOrUpdateHeyReachIntegration)
router.get("/campaigns", limit, auth, getHeyReachCampaigns)

export default router
