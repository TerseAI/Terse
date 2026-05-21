import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"
import { createOrUpdateWorkOSIntegration, getWorkOSIntegrations, updateWorkOSWebhookSecret } from "../../../routes/workosIntegration"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getWorkOSIntegrations)
router.post("/integrations", limit, auth, createOrUpdateWorkOSIntegration)
router.patch("/webhook-secret", limit, auth, updateWorkOSWebhookSecret)

export default router
