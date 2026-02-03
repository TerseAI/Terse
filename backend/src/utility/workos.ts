import { WorkOS } from "@workos-inc/node"

import { settings } from "../config/settings"
import { db } from "../prismaClient"
import { Role, User } from "../shared/types"

/**
 * WorkOS client instance - used for authentication, user management, and organization management.
 * This is a singleton shared across the application.
 */
export const workos = new WorkOS({
    apiKey: settings.workos.apiKey,
    clientId: settings.workos.clientId
})

/**
 * Fetches a user with their organization context from WorkOS.
 * This is used by integrations and other services that need user data.
 */
export async function getUserForOrg(userId: string, organizationId: string): Promise<User | null> {
    const prisma = db()
    const dbUser = await prisma.users.findUnique({
        where: { id: userId }
    })

    if (!dbUser) {
        return null
    }

    const workOSId = dbUser.workos_id
    const workOSUser = await workos.userManagement.getUser(workOSId)
    if (!workOSUser) {
        return null
    }

    const organization = await workos.organizations.getOrganization(organizationId)
    const organizationName = organization.name

    const organizationMemberships = await workos.userManagement.listOrganizationMemberships({
        userId: workOSId,
        organizationId: organizationId,
        statuses: ["active"]
    })
    if (!organizationMemberships.data) {
        return null
    }

    let roles: Role[] = []
    organizationMemberships.data.forEach(membership => {
        if (membership.organizationId === organizationId) {
            roles = (membership.roles?.map(role => role.slug) as Role[]) || []
        }
    })

    return {
        id: dbUser.id,
        workosId: workOSId,
        organizationId: organizationId,
        organizationName: organizationName,
        email: workOSUser.email,
        displayName: workOSUser.firstName + " " + workOSUser.lastName,
        firstName: workOSUser.firstName || null,
        lastName: workOSUser.lastName || null,
        displayPhotoUrl: workOSUser.profilePictureUrl || "",
        roles: roles
    }
}
