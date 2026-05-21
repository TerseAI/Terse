import { Router } from "express"

import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { attioOAuthCallback, getAttioIntegrations, getAttioObjects } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getAttioIntegrations)
router.get("/oauth-callback", rateLimit(RateLimitKind.AuthEndpoint), attioOAuthCallback)
router.get("/objects", limit, auth, getAttioObjects)

export default router
