import { Router } from "express"

import { AuthKind, requireAuth } from "../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

import { getStats } from "./controller"

const router = Router()

router.get("/", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), getStats)

export default router
