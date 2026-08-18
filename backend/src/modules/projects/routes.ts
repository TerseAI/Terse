import { Router } from "express"

import { AuthKind, requireAuth } from "../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

import {
    handleEnableSelfHosted,
    handleGetProjectById,
    handleGetProjectDeploys,
    handleListProjects,
    handleProjectDelete,
    handleRotateProjectApiKey,
    handleRotateProjectSigningSecret
} from "./controller"

const router = Router()

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/", limit, auth, handleListProjects)
router.get("/:id", limit, auth, handleGetProjectById)
router.delete("/:id", limit, auth, handleProjectDelete)
router.get("/:id/deploys", limit, auth, handleGetProjectDeploys)
router.post("/:id/enable-self-hosted", limit, auth, handleEnableSelfHosted)
router.post("/:id/rotate-signing-secret", limit, auth, handleRotateProjectSigningSecret)
router.post("/:id/rotate-api-key", limit, auth, handleRotateProjectApiKey)

export default router
