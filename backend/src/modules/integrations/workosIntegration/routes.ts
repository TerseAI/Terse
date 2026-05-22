import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { createOrUpdateWorkOSIntegration, getWorkOSIntegrations, updateWorkOSWebhookSecret } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getWorkOSIntegrations)
router.post("/integrations", limit, auth, createOrUpdateWorkOSIntegration)
router.patch("/webhook-secret", limit, auth, updateWorkOSWebhookSecret)

export default router
