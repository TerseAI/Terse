import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../auth/helpers/authMiddleware"

import { createOrUpdateResendIntegration, getResendIntegrations, getResendTemplates } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getResendIntegrations)
router.post("/integrations", limit, auth, createOrUpdateResendIntegration)
router.get("/templates", limit, auth, getResendTemplates)

export default router
