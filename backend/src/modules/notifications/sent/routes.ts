import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { getSentNotifications } from "./controller"

const router = Router()

router.get("/", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), getSentNotifications)

export default router
