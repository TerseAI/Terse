import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../domains/auth/helpers/authMiddleware"

import { toolsThatRequireApprovalsRoute } from "./controller"

const router = Router()

router.post("/that-require-approvals", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), toolsThatRequireApprovalsRoute)

export default router
