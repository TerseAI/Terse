import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../domains/auth/helpers/authMiddleware"

import { getAllRunHistory, getChatHistory, getRunHistory, getRunHistoryActions } from "./controller"

const router = Router()

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

// Order matters: literal "/actions" before generic "/:agentId"
router.get("/actions", limit, auth, getRunHistoryActions)
router.get("/", limit, auth, getAllRunHistory)
router.get("/:runId/chat", limit, auth, getChatHistory)
router.get("/:agentId", limit, auth, getRunHistory)

export default router
