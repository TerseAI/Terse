import { Router } from "express"

import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { handleToolDefinitions, handleToolExecute } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/tool-definitions", limit, auth, handleToolDefinitions)
router.post("/tool-execute", limit, auth, handleToolExecute)

export default router
