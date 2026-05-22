import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { createOrUpdateLaunchDarklyIntegration, getLaunchDarklyEnvironments, getLaunchDarklyIntegrations, getLaunchDarklyProjects } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations", limit, auth, getLaunchDarklyIntegrations)
router.post("/integrations", limit, auth, createOrUpdateLaunchDarklyIntegration)
router.get("/integrations/:integrationId/projects", limit, auth, getLaunchDarklyProjects)
router.get("/integrations/:integrationId/projects/:projectKey/environments", limit, auth, getLaunchDarklyEnvironments)

export default router
