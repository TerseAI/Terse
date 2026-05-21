import { Router } from "express"

import { RateLimitKind, rateLimit } from "../../../rateLimit/routeLimits"
import { AuthKind, requireAuth } from "../../../utility/authMiddleware"

import { handleDeleteProjectSecret, handleImportProjectSecrets, handleListProjectSecrets, handleUpsertProjectSecret } from "./controller"

// mergeParams=true is required so :id from the parent (mounted at /projects/:id/secrets) is accessible
const router = Router({ mergeParams: true })

const auth = requireAuth([AuthKind.UserCookie, AuthKind.UserToken])
const limit = rateLimit(RateLimitKind.Default)

router.get("/", limit, auth, handleListProjectSecrets)
router.post("/", limit, auth, handleUpsertProjectSecret)
router.post("/import", limit, auth, handleImportProjectSecrets)
router.delete("/:name", limit, auth, handleDeleteProjectSecret)

export default router
