import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../utility/authMiddleware"

import { disconnectIntegration, getActiveIntegrations, getAllIntegrations, getIntegrationInstallationDetails } from "./controller"

const router = Router()

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

// "/active" must come before "/:integrationType/..." so it matches as literal
router.get("/active", limit, auth, getActiveIntegrations)
router.get("/", limit, auth, getAllIntegrations)
router.get("/:integrationType/installation-details", limit, auth, getIntegrationInstallationDetails)
router.delete("/:integrationType/disconnect", limit, auth, disconnectIntegration)

export default router
