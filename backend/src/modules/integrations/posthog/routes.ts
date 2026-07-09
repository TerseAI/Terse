import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { createOrUpdatePosthogIntegration, getPosthogIntegrations, getPosthogProjectEvents, getPosthogProjects } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getPosthogIntegrations)
router.post("/integrations", limit, auth, createOrUpdatePosthogIntegration)
router.get("/projects", limit, auth, getPosthogProjects)
router.get("/events", limit, auth, getPosthogProjectEvents)

export default router
