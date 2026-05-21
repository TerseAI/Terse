import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"
import { createOrUpdatePosthogIntegration, getPosthogIntegrations, getPosthogProjects } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getPosthogIntegrations)
router.post("/integrations", limit, auth, createOrUpdatePosthogIntegration)
router.get("/projects", limit, auth, getPosthogProjects)

export default router
