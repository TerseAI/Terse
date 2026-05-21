import { Router } from "express"

import { AuthKind, requireAuth } from "../../../utility/authMiddleware"

import { reviewAllAgents } from "./controller"

// Cron callback (CloudScheduler auth) — mounted at root from server.ts
const router = Router()
router.post("/review-agents", requireAuth([AuthKind.CloudScheduler]), reviewAllAgents)

export default router
