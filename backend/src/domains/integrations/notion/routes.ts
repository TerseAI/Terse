import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"

import { getNotionIntegrations, getNotionResources, notionOAuthCallback } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getNotionIntegrations)
router.get("/oauth-callback", rateLimit(RateLimitKind.AuthEndpoint), notionOAuthCallback)
router.get("/resources", limit, auth, getNotionResources)

export default router
