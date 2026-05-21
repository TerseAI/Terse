import logger from "../../common/logger"
import { settings } from "../../settings"
import { getOrgLogoDownloadUrl, getOrgLogoUploadUrl } from "../../services/FileStorageService"
import { workos } from "../../integrations/workos/helpers"

export class UnauthorizedError extends Error {
    constructor() {
        super("Unauthorized")
        this.name = "UnauthorizedError"
    }
}

export class ForbiddenError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "ForbiddenError"
    }
}

export class BadRequestError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "BadRequestError"
    }
}

export class SessionExpiredError extends Error {
    constructor(message = "Session expired. Please log in again and try again.") {
        super(message)
        this.name = "SessionExpiredError"
    }
}

export interface CreateOrgResult {
    organization: { id: string; name: string }
    sealedSession: string
}

export async function createOrganizationForUser(input: {
    workosUserId: string
    userId: string
    name: string
    firstName?: string | null
    lastName?: string | null
    sealedSessionData: string | undefined
}): Promise<CreateOrgResult> {
    const { workosUserId, userId, name, firstName, lastName, sealedSessionData } = input

    if (firstName || lastName) {
        await workos.userManagement.updateUser({
            userId: workosUserId,
            firstName: typeof firstName === "string" ? firstName.trim() || undefined : undefined,
            lastName: typeof lastName === "string" ? lastName.trim() || undefined : undefined
        })
    }

    const organization = await workos.organizations.createOrganization({ name: name.trim() })
    await workos.userManagement.createOrganizationMembership({
        organizationId: organization.id,
        userId: workosUserId,
        roleSlug: "admin"
    })

    if (!sealedSessionData) {
        logger.error("Failed to create organization: no session cookie", { organizationId: organization.id, userId })
        throw new SessionExpiredError("Session expired. Please log in again and try creating the organization.")
    }

    const session = workos.userManagement.loadSealedSession({
        sessionData: sealedSessionData,
        cookiePassword: settings.workos.cookiePassword
    })
    const refreshResult = await session.refresh({
        organizationId: organization.id,
        cookiePassword: settings.workos.cookiePassword
    })

    if (!refreshResult.authenticated || !refreshResult.sealedSession) {
        logger.error("Failed to create organization: session refresh failed", { organizationId: organization.id, userId })
        throw new SessionExpiredError("Organization was created but we could not update your session. Please log out and log back in to use it.")
    }

    logger.info("Organization created", { organizationId: organization.id, userId, name: organization.name })
    return {
        organization: { id: organization.id, name: organization.name },
        sealedSession: refreshResult.sealedSession
    }
}

export async function getOrganizationDetails(organizationId: string): Promise<{ id: string; name: string }> {
    const organization = await workos.organizations.getOrganization(organizationId)
    return { id: organization.id, name: organization.name }
}

export async function listUserOrganizations(workosUserId: string): Promise<Array<{ id: string; name: string }>> {
    const memberships = await workos.userManagement.listOrganizationMemberships({ userId: workosUserId })
    const orgIds = [...new Set((memberships.data ?? []).map(m => m.organizationId))]
    return Promise.all(
        orgIds.map(async id => {
            const org = await workos.organizations.getOrganization(id)
            return { id: org.id, name: org.name }
        })
    )
}

export interface SwitchOrgResult {
    sealedSession: string
}

export async function switchUserOrganization(sealedSessionData: string, organizationId: string): Promise<SwitchOrgResult> {
    const session = workos.userManagement.loadSealedSession({
        sessionData: sealedSessionData,
        cookiePassword: settings.workos.cookiePassword
    })
    const refreshResult = await session.refresh({
        organizationId,
        cookiePassword: settings.workos.cookiePassword
    })
    if (!refreshResult.authenticated || !refreshResult.sealedSession) {
        throw new ForbiddenError("Not authorized for this organization")
    }
    return { sealedSession: refreshResult.sealedSession }
}

export async function getLogoUploadUrlForOrganization(organizationId: string, contentType: string): Promise<string> {
    if (!contentType.startsWith("image/")) throw new BadRequestError("Invalid content type. Must be an image.")
    const uploadUrl = await getOrgLogoUploadUrl(organizationId, contentType)
    if (!uploadUrl) throw new Error("Failed to generate upload URL")
    return uploadUrl
}

export async function getLogoUrlForOrganization(organizationId: string): Promise<string | null> {
    return getOrgLogoDownloadUrl(organizationId)
}

export async function updateOrganizationName(organizationId: string, name: string, userId: string): Promise<{ id: string; name: string }> {
    const organization = await workos.organizations.updateOrganization({
        organization: organizationId,
        name: name.trim()
    })
    logger.info("Organization updated", { organizationId: organization.id, userId, name: organization.name })
    return { id: organization.id, name: organization.name }
}
