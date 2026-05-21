import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"
import { createNotificationDestination, deleteNotificationDestination, getNotificationDestinations, updateNotificationDestination } from "./controller"

const router = Router()

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/", limit, auth, getNotificationDestinations)
router.post("/", limit, auth, createNotificationDestination)
router.put("/:id", limit, auth, updateNotificationDestination)
router.delete("/:id", limit, auth, deleteNotificationDestination)

export default router
