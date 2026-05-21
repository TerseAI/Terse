import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"
import { handleSdkRunTriggerEvent } from "./controller"

const router = Router()
router.get("/runs/:runId/trigger-event", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken]), handleSdkRunTriggerEvent)

export default router
