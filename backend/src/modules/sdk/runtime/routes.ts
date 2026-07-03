import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { handleMemoryDelete, handleMemoryGet, handleMemoryList, handleMemoryPut } from "../memory/controller"
import { handleStateGet, handleStatePut } from "../state/controller"

import {
    handleInputRequestRegister,
    handleJobPark,
    handleJobResumption,
    handleJobSuspension,
    handleSdkAgentRun,
    handleSdkApprovalDecision,
    handleSdkListen,
    handleSessionEvents
} from "./controller"

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
router.post("/input-request", limit, auth, handleInputRequestRegister)
router.post("/park", limit, auth, handleJobPark)

router.post("/memory/list", limit, auth, handleMemoryList)
router.post("/memory/get", limit, auth, handleMemoryGet)
router.post("/memory/put", limit, auth, handleMemoryPut)
router.post("/memory/delete", limit, auth, handleMemoryDelete)

router.post("/state/get", limit, auth, handleStateGet)
router.post("/state/put", limit, auth, handleStatePut)

export default router
