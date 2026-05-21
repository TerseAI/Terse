import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../utility/authMiddleware"
import { getUserById } from "./controller"

const router = Router()

router.get("/:id", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), getUserById)

export default router
