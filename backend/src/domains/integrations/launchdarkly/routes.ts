import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { createOrUpdateLaunchDarklyIntegration, getLaunchDarklyEnvironments, getLaunchDarklyIntegrations, getLaunchDarklyProjects } from "./controller"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getLaunchDarklyIntegrations)
router.post("/integrations", limit, auth, createOrUpdateLaunchDarklyIntegration)
router.get("/integrations/:integrationId/projects", limit, auth, getLaunchDarklyProjects)
router.get("/integrations/:integrationId/projects/:projectKey/environments", limit, auth, getLaunchDarklyEnvironments)

export default router
