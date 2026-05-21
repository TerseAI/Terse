import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"
import { handleSdkIntegrationFields, handleSdkIntegrationFormSubmit } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/integrations/:integrationType/fields", limit, auth, handleSdkIntegrationFields)
router.post("/integrations/:integrationType/form-submit", limit, auth, handleSdkIntegrationFormSubmit)

export default router
