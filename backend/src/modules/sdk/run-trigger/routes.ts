import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { handleSdkRunTriggerEvent } from "./controller"

const router = Router()
router.get("/runs/:runId/trigger-event", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), handleSdkRunTriggerEvent)

export default router
