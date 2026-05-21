import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../utility/authMiddleware"
import { applyImprovement, dismissImprovement, getAgentImprovements, toggleImprovementsEnabled, undoDismissImprovement } from "./controller"

// Mounted at /agents/:agentId — mergeParams pulls :agentId from the parent
const router = Router({ mergeParams: true })

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/improvements", limit, auth, getAgentImprovements)
router.post("/improvements/:id/apply", limit, auth, applyImprovement)
router.post("/improvements/:id/dismiss", limit, auth, dismissImprovement)
router.post("/improvements/:id/undo-dismiss", limit, auth, undoDismissImprovement)
router.patch("/improvements-enabled", limit, auth, toggleImprovementsEnabled)

export default router
