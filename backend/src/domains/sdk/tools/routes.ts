import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"

import { handleToolDefinitions, handleToolExecute } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/tool-definitions", limit, auth, handleToolDefinitions)
router.post("/tool-execute", limit, auth, handleToolExecute)

export default router
