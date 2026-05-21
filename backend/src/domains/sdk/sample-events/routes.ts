import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../domains/auth/helpers/authMiddleware"

import { handleHydrateSampleEvent, handleSampleEvents } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.post("/sample-events", limit, auth, handleSampleEvents)
router.post("/sample-events/hydrate", limit, auth, handleHydrateSampleEvent)

export default router
