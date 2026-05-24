import { Request, Response } from "express"

import logger from "../../common/logger"
import { resolveUserInOrg } from "../../utility/identity"

export async function getUserById(req: Request, res: Response) {
    const requester = req.session?.user
    if (!requester) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const organizationId = requester.organizationId
    if (!organizationId) {
        return res.status(400).json({ error: "Organization context is required" })
    }

    const userId = req.params.id
    if (!userId || typeof userId !== "string") {
        return res.status(400).json({ error: "User ID is required" })
    }

    try {
        const user = await resolveUserInOrg(userId, organizationId)
        if (!user) {
            return res.status(404).json({ error: "User not found" })
        }
        return res.status(200).json(user)
    } catch (error: unknown) {
        const statusCode = typeof error === "object" && error !== null && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : undefined
        if (statusCode === 404) {
            return res.status(404).json({ error: "User not found" })
        }

        logger.error("Failed to fetch user by ID", {
            error,
            requestedUserId: userId,
            requesterUserId: requester.id,
            organizationId
        })
        return res.status(500).json({ error: "Failed to fetch user" })
    }
}
