import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"

import { reviewAllAgents } from "./controller"

// Cron callback (CloudScheduler auth) — mounted at root from server.ts
const router = Router()
router.post("/review-agents", reviewAllAgents)

export default router
