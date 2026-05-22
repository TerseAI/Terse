import { Router } from "express"

import { AuthKind, requireAuth } from "../../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"

import { handleHydrateSampleEvent, handleSampleEvents } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.post("/sample-events", limit, auth, handleSampleEvents)
router.post("/sample-events/hydrate", limit, auth, handleHydrateSampleEvent)

export default router
