import { Router } from "express"

import { AuthKind, requireAuth } from "../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

import { getUserById } from "./controller"

const router = Router()

router.get("/:id", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), getUserById)

export default router
