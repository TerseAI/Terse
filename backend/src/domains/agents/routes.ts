import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../rateLimit/routeLimits"
// Handlers still live in routes/agents.ts (842 LOC); a future PR can decompose
// them into routes/controller/service/repository within this domain folder.
// For now we just consolidate the routing into a domain router.
import { deleteAgent, getAgentFileContent, getAgentFiles, getRecentAgents, getUserAgent, getUserAgents, updateAgent } from "../../routes/agents"
import { AuthKind, requireAuth } from "../../utility/authMiddleware"

const router = Router()
const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/", limit, auth, getUserAgents)
router.get("/recent", limit, auth, getRecentAgents)
router.get("/:id", limit, auth, getUserAgent)
router.patch("/:id", limit, auth, updateAgent)
router.delete("/:id", limit, auth, deleteAgent)
router.get("/:agentId/files", limit, auth, getAgentFiles)
router.get("/:agentId/files/:fileId", limit, auth, getAgentFileContent)

export default router
