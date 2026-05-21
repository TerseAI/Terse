import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../utility/authMiddleware"

import { createOrganization, getCurrentOrganization, getLogoUploadUrl, getLogoUrl, getUserOrganizations, switchOrganization, updateOrganization } from "./controller"

const router = Router()

const limit = rateLimit(RateLimitKind.Default)
// Create + GetCurrent allow no-org users (they're how they create their first org)
const authNoOrg = requireAuth([AuthKind.UserCookie, AuthKind.UserToken], { allowNoOrg: true })
const authStandard = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])

router.post("/", limit, authNoOrg, createOrganization)
router.get("/current", limit, authNoOrg, getCurrentOrganization)
router.get("/", limit, authStandard, getUserOrganizations)
router.post("/switch", limit, authStandard, switchOrganization)
router.put("/", limit, authStandard, updateOrganization)
router.get("/logo/upload-url", limit, authStandard, getLogoUploadUrl)
router.get("/:organizationId/logo", limit, authStandard, getLogoUrl)

export default router
