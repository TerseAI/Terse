import { Request, Response } from "express"

import logger from "../logger"
import { db } from "../prismaClient"
import { Role, User } from "../shared/types"
import { workos } from "../utility/workos"

function isRole(role: string): role is Role {
    return role === "admin" || role === "user"
}

// GET /users/:id - Fetch a user in the current organization
export async function getUserById(req: Request, res: Response) {
    const requester = req.session?.user
    if (!requester) {
        return res.status(401).json({ error: "Unauthorized" })
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
        const prisma = db()
        const dbUser = await prisma.users.findUnique({
            where: { id: userId }
        })

        if (!dbUser) {
            return res.status(404).json({ error: "User not found" })
        }

        const memberships = await workos.userManagement.listOrganizationMemberships({
            userId: dbUser.workos_id,
            organizationId,
            statuses: ["active"]
        })

        const membership = (memberships.data ?? []).find(entry => entry.organizationId === organizationId)
        if (!membership) {
            // Avoid leaking existence of users outside the requester's organization.
            return res.status(404).json({ error: "User not found" })
        }

        const workOSUser = await workos.userManagement.getUser(dbUser.workos_id)

        const roles: Role[] = (membership.roles ?? []).map(role => role.slug).filter(isRole)

        const response: User = {
            id: dbUser.id,
            workosId: dbUser.workos_id,
            organizationId,
            organizationName: requester.organizationName,
            email: workOSUser.email,
            displayName: workOSUser.firstName + " " + workOSUser.lastName,
            firstName: workOSUser.firstName || null,
            lastName: workOSUser.lastName || null,
            displayPhotoUrl: workOSUser.profilePictureUrl || "",
            roles
        }

        return res.status(200).json(response)
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
