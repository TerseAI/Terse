import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"
import { handleSdkAgentRun, handleSdkApprovalDecision, handleSdkListen, handleSessionEvents } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken])
const limit = rateLimit(RateLimitKind.Default)

router.post("/agent-run", limit, auth, handleSdkAgentRun)
router.post("/approval-decision", limit, auth, handleSdkApprovalDecision)
router.get("/session-events", limit, auth, handleSessionEvents)
router.get("/listen", limit, auth, handleSdkListen)

export default router
