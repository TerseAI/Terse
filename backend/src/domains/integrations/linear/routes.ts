import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"

import { getLinearIntegrations, getLinearProjects, getLinearTeams, linearOAuthCallback } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/oauth-callback", rateLimit(RateLimitKind.AuthEndpoint), linearOAuthCallback)
router.get("/integrations", limit, auth, getLinearIntegrations)
router.get("/teams", limit, auth, getLinearTeams)
router.get("/projects", limit, auth, getLinearProjects)

export default router
