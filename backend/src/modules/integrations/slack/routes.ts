import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { getCurrentSlackIntegration, getSlackChannels, getSlackIntegrations, getSlackUsers, slackOAuthCallback } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getSlackIntegrations)
router.get("/get-current-integration", limit, auth, getCurrentSlackIntegration)
router.get("/oauth-callback", rateLimit(RateLimitKind.AuthEndpoint), slackOAuthCallback)
router.get("/channels", limit, auth, getSlackChannels)
router.get("/users", limit, auth, getSlackUsers)

export default router
