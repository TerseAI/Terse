import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../utility/authMiddleware"
import { getStats } from "./controller"

const router = Router()

router.get("/", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), getStats)

export default router
