import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { handleSdkTestRunFinalize, handleSdkTestRunStart } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken, AuthKind.ProjectToken])
const limit = rateLimit(RateLimitKind.Default)

router.post("/test-run", limit, auth, handleSdkTestRunStart)
router.post("/test-run/:runId/finalize", limit, auth, handleSdkTestRunFinalize)

export default router
