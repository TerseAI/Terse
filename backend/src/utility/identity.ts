import { UserSession } from "terse-types/types"

import logger from "../common/logger"
import { db } from "../loaders/prisma"
import { getAuthProvider } from "../services/authProvider"
import { getOrganizationProvider } from "../services/organizationProvider"

/**
 * Build the session-shape `UserSession` for an identity in an org context.
 * Composes the auth + organization providers: identity from one, org name
 * and roles from the other. Returns null if the identity isn't found or isn't
 * an active member of the org.
 */
export async function resolveUserInOrg(externalUserId: string, organizationId: string): Promise<UserSession | null> {
    const [profile, membership] = await Promise.all([getAuthProvider().getUser(externalUserId), getOrganizationProvider().getMembership(externalUserId, organizationId)])
    if (!profile || !membership) return null
    return {
        ...profile,
        organizationId,
        organizationName: membership.organizationName,
        roles: membership.roles
    }
}
