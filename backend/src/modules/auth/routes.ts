import { Router } from "express"

import { GithubIntegrationManager } from "../../integrations/github/integration"
import { AuthKind, requireAuth } from "../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

import { callback, getWorkOSWidgetToken, githubAppCallbackIntegrate, login, loginUrl, logout, logoutUrl, me } from "./controller"

const router = Router()

const authEndpointLimit = rateLimit(RateLimitKind.AuthEndpoint)
const defaultLimit = rateLimit(RateLimitKind.Default)

// /me — authenticated, allows users without an organization
router.get("/me", defaultLimit, requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { allowNoOrg: true }), me)

// /login + /logout endpoints — public, OAuth flow
router.get("/login", authEndpointLimit, login)
router.get("/login/url", authEndpointLimit, loginUrl)
router.get("/logout", authEndpointLimit, logout)
router.get("/logout/url", authEndpointLimit, logoutUrl)

if (new GithubIntegrationManager().isAvailable) {
    router.get("/auth/github-app/callback", authEndpointLimit, githubAppCallbackIntegrate)
}
router.get("/auth/workos/callback", authEndpointLimit, callback)

// /auth/workos/widget-token — authenticated, returns widget JWT
router.get("/auth/workos/widget-token", defaultLimit, requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), getWorkOSWidgetToken)

export default router
