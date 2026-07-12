import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { attioOAuthCallback, getAttioIntegrations, getAttioLists, getAttioObjects } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getAttioIntegrations)
router.get("/oauth/callback", rateLimit(RateLimitKind.AuthEndpoint), attioOAuthCallback)
router.get("/integrations/:integrationId/objects", limit, auth, getAttioObjects)
router.get("/integrations/:integrationId/lists", limit, auth, getAttioLists)

export default router
