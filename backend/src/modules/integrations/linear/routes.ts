import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { getLinearIntegrations, getLinearProjects, getLinearTeams, linearOAuthCallback } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/oauth-callback", rateLimit(RateLimitKind.AuthEndpoint), linearOAuthCallback)
router.get("/integrations", limit, auth, getLinearIntegrations)
router.get("/teams", limit, auth, getLinearTeams)
router.get("/projects", limit, auth, getLinearProjects)

export default router
