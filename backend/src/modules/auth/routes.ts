import { Router } from "express"

import { AuthKind, requireAuth } from "../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

import { login, loginUrl, logout, logoutUrl, me } from "./controller"

const router = Router()

const authEndpointLimit = rateLimit(RateLimitKind.AuthEndpoint)
const defaultLimit = rateLimit(RateLimitKind.Default)

// /me — authenticated, allows users without an organization
router.get("/me", defaultLimit, requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { allowNoOrg: true }), me)

// /login + /logout — provider-agnostic flow entrypoints
router.get("/login", authEndpointLimit, login)
router.get("/login/url", authEndpointLimit, loginUrl)
router.get("/logout", authEndpointLimit, logout)
router.get("/logout/url", authEndpointLimit, logoutUrl)

export default router
