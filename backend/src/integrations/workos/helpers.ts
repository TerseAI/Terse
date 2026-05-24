import { NotFoundException, WorkOS } from "@workos-inc/node"
import type { EventName } from "@workos-inc/node"
import { WorkOSEventType } from "terse-types/Configs"
import { Role, User } from "terse-types/types"

import logger from "../../common/logger"
import { settings } from "../../settings"

// Compile-time check: every WorkOSEventType must be a valid @workos-inc/node EventName
const _assertValidEventNames: readonly EventName[] = Object.values(WorkOSEventType)
void _assertValidEventNames

/**
 * WorkOS client instance - used for authentication, user management, and organization management.
 * This is a singleton shared across the application.
 */
export const workos = new WorkOS({
    apiKey: settings.workos.apiKey,
    clientId: settings.workos.clientId
})

/**
 * Fetches a user with their organization context from WorkOS. Used by API-token
 * auth and integration paths that hold a workos_id (no DB join needed — the
 * workos_id is the identity).
 */
export async function resolveUserInOrg(workosUserId: string, organizationId: string): Promise<User | null> {
    let workOSUser
    try {
        workOSUser = await workos.userManagement.getUser(workosUserId)
    } catch (error) {
        if (error instanceof NotFoundException) {
            logger.warn("WorkOS user not found", { workosUserId, organizationId })
            return null
        }
        throw error
    }
    if (!workOSUser) return null

    const organization = await workos.organizations.getOrganization(organizationId)

    const organizationMemberships = await workos.userManagement.listOrganizationMemberships({
        userId: workosUserId,
        organizationId,
        statuses: ["active"]
    })
    const matchingMembership = organizationMemberships.data?.find(m => m.organizationId === organizationId)
    if (!matchingMembership) return null

    const roles: Role[] = (matchingMembership.roles?.map(role => role.slug) as Role[]) ?? []

    return {
        id: workOSUser.id,
        organizationId,
        organizationName: organization.name,
        email: workOSUser.email,
        displayName: [workOSUser.firstName, workOSUser.lastName].filter(Boolean).join(" "),
        firstName: workOSUser.firstName || null,
        lastName: workOSUser.lastName || null,
        displayPhotoUrl: workOSUser.profilePictureUrl || "",
        roles
    }
}
