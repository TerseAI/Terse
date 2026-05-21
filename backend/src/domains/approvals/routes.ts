import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../utility/authMiddleware"

import { getPendingApprovals } from "./controller"

const router = Router()

router.get("/", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), getPendingApprovals)

export default router
