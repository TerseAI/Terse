import { Role, User } from "terse-types/types"

import { workos } from "../../integrations/workos/helpers"

import { findUserById } from "./repository"

export class UserNotFoundError extends Error {
    constructor() {
        super("User not found")
        this.name = "UserNotFoundError"
    }
}

function isRole(role: string): role is Role {
    return role === "admin" || role === "user"
}

export async function getUserInOrganization(userId: string, organizationId: string, organizationName: string): Promise<User> {
    const dbUser = await findUserById(userId)
    if (!dbUser) {
        throw new UserNotFoundError()
    }

    const memberships = await workos.userManagement.listOrganizationMemberships({
        userId: dbUser.workos_id,
        organizationId,
        statuses: ["active"]
    })

    const membership = (memberships.data ?? []).find(entry => entry.organizationId === organizationId)
    if (!membership) {
        // Avoid leaking existence of users outside the requester's organization.
        throw new UserNotFoundError()
    }

    const workOSUser = await workos.userManagement.getUser(dbUser.workos_id)
    const roles: Role[] = (membership.roles ?? []).map(role => role.slug).filter(isRole)

    return {
        id: dbUser.id,
        workosId: dbUser.workos_id,
        organizationId,
        organizationName,
        email: workOSUser.email,
        displayName: workOSUser.firstName + " " + workOSUser.lastName,
        firstName: workOSUser.firstName || null,
        lastName: workOSUser.lastName || null,
        displayPhotoUrl: workOSUser.profilePictureUrl || "",
        roles
    }
}
