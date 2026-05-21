import { Router } from "express"

import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { getGithubIntegrations, getGithubRepositoriesForIntegration } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getGithubIntegrations)
router.get("/get-repositories-for-integration", limit, auth, getGithubRepositoriesForIntegration)

export default router
