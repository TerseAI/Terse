import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { getNotionIntegrations, getNotionResources, notionOAuthCallback } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getNotionIntegrations)
router.get("/oauth/callback", rateLimit(RateLimitKind.AuthEndpoint), notionOAuthCallback)
router.get("/resources", limit, auth, getNotionResources)

export default router
