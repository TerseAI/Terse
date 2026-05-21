import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"

import { handleVerifySdkJobServer } from "./controller"

// Mounted under /sdk — relative path is /agents/:agentId/verify-job-server
const router = Router()
router.post("/agents/:agentId/verify-job-server", rateLimit(RateLimitKind.Default), requireAuth([AuthKind.UserCookie, AuthKind.UserToken]), handleVerifySdkJobServer)

export default router
