import { Router } from "express"

import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { deviceTokenExchange, identify, listMyOrganizations, sdkMe, switchOrganization } from "./controller"

const router = Router()

// Public endpoints (device-code flow): use bespoke rate limits
router.post("/auth/identify", rateLimit(RateLimitKind.Identify), identify)
router.post("/auth/device-token-exchange", rateLimit(RateLimitKind.TokenMinting), deviceTokenExchange)

// Authenticated endpoints
router.post("/auth/switch-organization", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserToken]), switchOrganization)
router.get("/me", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), sdkMe)
router.get("/me/organizations", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), listMyOrganizations)

export default router
