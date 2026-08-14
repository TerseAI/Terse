import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { handleProjectCreate } from "../../../modules/projects/controller"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { handleSdkDeploy, handleSdkSourceUpload } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.post("/deploy", limit, auth, handleSdkDeploy)
router.post("/deploy/source-upload", limit, auth, handleSdkSourceUpload)
// SDK.CREATE_PROJECT = /sdk/projects — uses projects domain controller
router.post("/projects", limit, auth, handleProjectCreate)

export default router
