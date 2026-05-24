import { Router } from "express"

import { AuthKind, requireAuth } from "../../modules/auth/helpers/authMiddleware"
import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"

// Handlers still live in routes/agents.ts (842 LOC); a future PR can decompose
// them into routes/controller/service/repository within this domain folder.
// For now we just consolidate the routing into a domain router.
import { deleteAgent, getRecentAgents, getUserAgent, getUserAgents, updateAgent } from "./controller"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/", limit, auth, getUserAgents)
router.get("/recent", limit, auth, getRecentAgents)
router.get("/:id", limit, auth, getUserAgent)
router.patch("/:id", limit, auth, updateAgent)
router.delete("/:id", limit, auth, deleteAgent)

export default router
