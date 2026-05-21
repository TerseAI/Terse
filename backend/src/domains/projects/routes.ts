import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../domains/auth/helpers/authMiddleware"

import {
    handleGetProjectById,
    handleGetProjectDeploys,
    handleGetProjectSourceFileContent,
    handleGetProjectSourceFiles,
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
router.get("/:id/source/files", limit, auth, handleGetProjectSourceFiles)
router.get("/:id/source/files/:fileId", limit, auth, handleGetProjectSourceFileContent)
router.post("/:id/rotate-signing-secret", limit, auth, handleRotateProjectSigningSecret)
router.post("/:id/rotate-api-key", limit, auth, handleRotateProjectApiKey)

export default router
