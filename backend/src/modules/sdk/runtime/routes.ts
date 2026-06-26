import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { handleJobResumption, handleJobSuspension, handleSdkAgentRun, handleSdkApprovalDecision, handleSdkListen, handleSessionEvents } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken])
const schedulerAuth = requireAuth([AuthKind.CloudScheduler])
const limit = rateLimit(RateLimitKind.Default)

router.post("/agent-run", limit, auth, handleSdkAgentRun)
router.post("/approval-decision", limit, auth, handleSdkApprovalDecision)
router.get("/session-events", limit, auth, handleSessionEvents)
router.get("/listen", limit, auth, handleSdkListen)
router.post("/suspend", limit, auth, handleJobSuspension)
router.post("/resume", limit, schedulerAuth, handleJobResumption)

export default router
