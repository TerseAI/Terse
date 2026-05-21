import { Router } from "express"

import { AuthKind, requireAuth } from "../../domains/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

import { createApiToken, deleteApiToken, getApiTokens, updateApiToken } from "./controller"

const router = Router()

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/", limit, auth, getApiTokens)
router.post("/", limit, auth, createApiToken)
router.patch("/:id", limit, auth, updateApiToken)
router.delete("/:id", limit, auth, deleteApiToken)

export default router
