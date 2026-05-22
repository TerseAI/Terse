import { Router } from "express"

import { AuthKind, requireAuth } from "../../modules/auth/helpers/authMiddleware"

import { clearOldSecretVersions, refreshAllTokens, scrubExpiredRunHistoryHandler } from "./controller"

// Mounted at root — cron callbacks (CloudScheduler auth)
const router = Router()

router.post("/refresh-tokens", requireAuth([AuthKind.CloudScheduler]), refreshAllTokens)
router.post("/clear-old-secret-versions", requireAuth([AuthKind.CloudScheduler]), clearOldSecretVersions)
router.post("/scrub-pii", requireAuth([AuthKind.CloudScheduler]), scrubExpiredRunHistoryHandler)

export default router
