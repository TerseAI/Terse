import { Router } from "express"

import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"
import { handleProjectCreate } from "../../../domains/projects/controller"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { handleSdkDeploy } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.post("/deploy", limit, auth, handleSdkDeploy)
// SDK.CREATE_PROJECT = /sdk/projects — uses projects domain controller
router.post("/projects", limit, auth, handleProjectCreate)

export default router
