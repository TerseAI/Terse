import { Router } from "express"

import { AuthKind, requireAuth } from "../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

import { disconnectIntegration, getActiveIntegrations, getAllIntegrations, getIntegrationConnections, getIntegrationInstallationDetails } from "./controller"

const router = Router()

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

// "/active" must come before "/:integrationType/..." so it matches as literal
router.get("/active", limit, auth, getActiveIntegrations)
router.get("/", limit, auth, getAllIntegrations)
router.get("/:integrationType/installation-details", limit, auth, getIntegrationInstallationDetails)
router.get("/:integrationType/connections", limit, auth, getIntegrationConnections)
router.delete("/:integrationType/disconnect", limit, auth, disconnectIntegration)

export default router
