import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { getMetaAdsAdAccounts, getMetaAdsIntegrations, getMetaAdsPages, metaAdsOAuthCallback } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getMetaAdsIntegrations)
router.get("/oauth/callback", rateLimit(RateLimitKind.AuthEndpoint), metaAdsOAuthCallback)
router.get("/integrations/:integrationId/adaccounts", limit, auth, getMetaAdsAdAccounts)
router.get("/integrations/:integrationId/pages", limit, auth, getMetaAdsPages)

export default router
