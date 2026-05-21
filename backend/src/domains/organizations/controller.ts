import { Request, Response } from "express"
import { logoParamsSchema, logoUploadUrlQuerySchema, organizationCreateRequestSchema, organizationSwitchRequestSchema, organizationUpdateRequestSchema } from "terse-types/types"

import logger from "../../common/logger"
import { settings } from "../../config/settings"
import { WORKOS_SESSION_COOKIE_NAME, setSessionCookie } from "../../routes/auth"

import {
    BadRequestError,
    ForbiddenError,
    SessionExpiredError,
    createOrganizationForUser,
    getLogoUploadUrlForOrganization,
    getLogoUrlForOrganization,
    getOrganizationDetails,
    listUserOrganizations,
    switchUserOrganization,
    updateOrganizationName
} from "./service"

export async function createOrganization(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    const { name, firstName, lastName } = organizationCreateRequestSchema.parse(req.body)
    try {
        const result = await createOrganizationForUser({
            workosUserId: user.workosId,
            userId: user.id,
            name,
            firstName,
            lastName,
            sealedSessionData: req.cookies[WORKOS_SESSION_COOKIE_NAME]
        })
        setSessionCookie(res, result.sealedSession)
        res.status(201).json(result.organization)
    } catch (error) {
        if (error instanceof SessionExpiredError) return res.status(500).json({ error: error.message })
        logger.error("Failed to create organization", { error, userId: user.id, name: name.trim() })
        res.status(500).json({ error: "Failed to create organization. Please try again." })
    }
}

export async function getCurrentOrganization(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    if (!user.organizationId) {
        return res.status(404).json({ error: "User has no organization", code: "ORGANIZATION_REQUIRED", redirectTo: "/organization/create" })
    }
    try {
        const response = await getOrganizationDetails(user.organizationId)
        res.json(response)
    } catch (error) {
        logger.error("Failed to get organization from WorkOS", { error, organizationId: user.organizationId })
        res.status(500).json({ error: "Failed to load organization." })
    }
}

export async function getUserOrganizations(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    if (!user.workosId) return res.status(400).json({ error: "User has no WorkOS ID. Re-authenticate to link account." })
    try {
        const organizations = await listUserOrganizations(user.workosId)
        res.json({ organizations })
    } catch (error) {
        logger.error("Failed to list user organizations", { error, userId: user.id })
        res.status(500).json({ error: "Failed to load organizations." })
    }
}

export async function switchOrganization(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    const { organizationId } = organizationSwitchRequestSchema.parse(req.body)
    const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
    if (!sealedSessionData) return res.status(401).json({ error: "No session" })
    try {
        const { sealedSession } = await switchUserOrganization(sealedSessionData, organizationId)
        setSessionCookie(res, sealedSession)
        res.json({ success: true })
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return res.status(403).json({ error: error.message, redirectUrl: settings.urls.frontend })
        }
        logger.error("Failed to switch organization", { error, userId: user.id, organizationId })
        res.status(500).json({ error: "Failed to switch organization.", redirectUrl: settings.urls.frontend })
    }
}

export async function getLogoUploadUrl(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    if (!user.roles?.includes("admin")) return res.status(403).json({ error: "Only admins can upload organization logos" })
    if (!user.organizationId) return res.status(400).json({ error: "No organization" })

    const { contentType } = logoUploadUrlQuerySchema.parse(req.query)
    try {
        const uploadUrl = await getLogoUploadUrlForOrganization(user.organizationId, contentType)
        res.json({ uploadUrl })
    } catch (error) {
        if (error instanceof BadRequestError) return res.status(400).json({ error: error.message })
        logger.error("Failed to generate logo upload URL", { error, userId: user.id, organizationId: user.organizationId })
        res.status(500).json({ error: "Failed to generate upload URL" })
    }
}

export async function getLogoUrl(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    const { organizationId } = logoParamsSchema.parse(req.params)
    try {
        const logoUrl = await getLogoUrlForOrganization(organizationId)
        res.json({ logoUrl })
    } catch (error) {
        logger.error("Failed to get logo URL", { error, userId: user.id, organizationId })
        res.status(500).json({ error: "Failed to get logo URL" })
    }
}

export async function updateOrganization(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) return res.status(401).json({ error: "Unauthorized" })
    if (!user.roles?.includes("admin")) return res.status(403).json({ error: "Only admins can update organization settings" })
    if (!user.organizationId) return res.status(400).json({ error: "No organization" })

    const { name } = organizationUpdateRequestSchema.parse(req.body)
    try {
        const response = await updateOrganizationName(user.organizationId, name, user.id)
        res.json(response)
    } catch (error) {
        logger.error("Failed to update organization", { error, userId: user.id, organizationId: user.organizationId })
        res.status(500).json({ error: "Failed to update organization" })
    }
}
