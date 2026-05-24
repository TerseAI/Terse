import { Role, User } from "terse-types/types"

import { workos } from "../../integrations/workos/helpers"

export class UserNotFoundError extends Error {
    constructor() {
        super("User not found")
        this.name = "UserNotFoundError"
    }
}

export async function getUserInOrganization(workosUserId: string, organizationId: string, organizationName: string): Promise<User> {
    const memberships = await workos.userManagement.listOrganizationMemberships({
        userId: workosUserId,
        organizationId,
        statuses: ["active"]
    })

    const membership = (memberships.data ?? []).find(entry => entry.organizationId === organizationId)
    if (!membership) {
        // Avoid leaking existence of users outside the requester's organization.
        throw new UserNotFoundError()
    }

    const workOSUser = await workos.userManagement.getUser(workosUserId)
    const roles: Role[] = (membership.roles ?? []).map(role => role.slug).filter(isRole)

    return {
        id: workOSUser.id,
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

function isRole(role: string): role is Role {
    return role === "admin" || role === "user"
}
