import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"

import { deleteGmailIntegration, getGmailIntegrations, gmailCallback } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getGmailIntegrations)
router.get("/callback", rateLimit(RateLimitKind.AuthEndpoint), gmailCallback)
router.delete("/integrations/:id", limit, auth, deleteGmailIntegration)

export default router
