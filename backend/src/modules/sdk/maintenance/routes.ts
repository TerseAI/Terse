import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"

import { cleanupSdkImages } from "./controller"

// Mounted at root — /cleanup-sdk-images is a cron callback (CloudScheduler auth)
const router = Router()
router.post("/cleanup-sdk-images", requireAuth([AuthKind.CloudScheduler]), cleanupSdkImages)

export default router
