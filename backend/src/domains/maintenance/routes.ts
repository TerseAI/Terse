import { Router } from "express"

import { AuthKind, requireAuth } from "../../domains/auth/helpers/authMiddleware"

import { clearOldSecretVersions, refreshAllTokens } from "./controller"

// Mounted at root — cron callbacks (CloudScheduler auth)
const router = Router()

router.post("/refresh-tokens", requireAuth([AuthKind.CloudScheduler]), refreshAllTokens)
router.post("/clear-old-secret-versions", requireAuth([AuthKind.CloudScheduler]), clearOldSecretVersions)

export default router
