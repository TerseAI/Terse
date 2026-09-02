import { WorkOS } from "@workos-inc/node"
import { Request, Response } from "express"
import { logoParamsSchema, logoUploadUrlQuerySchema, organizationCreateRequestSchema, organizationSwitchRequestSchema, organizationUpdateRequestSchema } from "terse-types"
import { Membership, Organization, Role } from "terse-types/types"

import { AnalyticsEvent, analytics } from "../../../common/analytics"
import logger from "../../../common/logger"
import { getOrCreateOrganizationExecutionRegion, setOrganizationExecutionRegion } from "../../../services/OrganizationSettingsService"
import OrganizationProvider from "../../../services/organizationProvider/OrganizationProvider"
import { SettingsDependant, settings } from "../../../settings"
import { WORKOS_SESSION_COOKIE_NAME, setSessionCookie } from "../authProvider/service"

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

export class WorkOSOrganizationProvider extends SettingsDependant implements OrganizationProvider {
    readonly settingsKey = "workos"

    readonly workos = new WorkOS({
        apiKey: this.config.apiKey,
        clientId: this.config.clientId
    })

    async getOrganization(organizationId: string): Promise<Organization | null> {
        const organization = await this.workos.organizations.getOrganization(organizationId)
        if (!organization) return null
        return { id: organization.id, name: organization.name }
    }

    async getMembership(externalUserId: string, organizationId: string): Promise<Membership | null> {
        const organizationMemberships = await this.workos.userManagement.listOrganizationMemberships({
            userId: externalUserId,
            organizationId,
            statuses: ["active"]
        })
        const matching = organizationMemberships.data?.find(m => m.organizationId === organizationId)
        if (!matching) return null
        const organization = await this.workos.organizations.getOrganization(organizationId)
        const roles: Role[] = (matching.roles?.map(r => r.slug) as Role[]) ?? []
        return { organizationId: organization.id, organizationName: organization.name, roles }
    }

    async getMemberships(externalUserId: string): Promise<Membership[]> {
        const memberships = await this.workos.userManagement.listOrganizationMemberships({
            userId: externalUserId,
            statuses: ["active"]
        })
        if (!memberships) return []
        return memberships.data.map(m => ({ organizationId: m.organizationId, organizationName: m.organizationName, roles: m.roles?.map(r => r.slug as Role) ?? [] }))
    }

    async createOrganization(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        const { name, firstName, lastName, executionRegion } = organizationCreateRequestSchema.parse(req.body)
        try {
            const result = await createOrganizationForUser({
                workos: this.workos,
                workosCookiePassword: this.config.cookiePassword,
                workosUserId: user.id,
                name,
                firstName,
                lastName,
                sealedSessionData: req.cookies[WORKOS_SESSION_COOKIE_NAME]
            })
            await setOrganizationExecutionRegion(result.organization.id, executionRegion)
            logger.info("Organization execution region initialized", {
                organizationId: result.organization.id,
                userId: user.id,
                previousExecutionRegion: null,
                executionRegion
            })
            analytics.capture(user.id, AnalyticsEvent.ORGANIZATION_EXECUTION_REGION_SET, {
                organizationId: result.organization.id,
                previousExecutionRegion: null,
                executionRegion,
                source: "creation"
            })
            analytics.groupIdentify(result.organization.id, { executionRegion })
            setSessionCookie(res, result.sealedSession)
            res.status(201).json({ ...result.organization, executionRegion })
        } catch (error) {
            if (error instanceof SessionExpiredError) {
                res.status(500).json({ error: error.message })
                return
            }
            logger.error("Failed to create organization", { error, userId: user.id, name: name.trim() })
            res.status(500).json({ error: "Failed to create organization. Please try again." })
        }
    }

    async getCurrentOrganization(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        if (!user.organizationId) {
            res.status(404).json({ error: "User has no organization", code: "ORGANIZATION_REQUIRED", redirectTo: "/organization/create" })
            return
        }
        try {
            const [organization, executionRegion] = await Promise.all([getOrganizationDetails(this.workos, user.organizationId), getOrCreateOrganizationExecutionRegion(user.organizationId)])
            res.json({ ...organization, executionRegion })
        } catch (error) {
            logger.error("Failed to get organization from WorkOS", { error, organizationId: user.organizationId })
            res.status(500).json({ error: "Failed to load organization." })
        }
    }

    async getUserOrganizations(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        try {
            const organizations = await listUserOrganizations(this.workos, user.id)
            res.json({ organizations })
        } catch (error) {
            logger.error("Failed to list user organizations", { error, userId: user.id })
            res.status(500).json({ error: "Failed to load organizations." })
        }
    }

    async switchOrganization(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        const { organizationId } = organizationSwitchRequestSchema.parse(req.body)
        const sealedSessionData = req.cookies[WORKOS_SESSION_COOKIE_NAME]
        if (!sealedSessionData) {
            res.status(401).json({ error: "No session" })
            return
        }
        try {
            const { sealedSession } = await switchUserOrganization(this.workos, this.config.cookiePassword, sealedSessionData, organizationId)
            setSessionCookie(res, sealedSession)
            res.json({ success: true })
        } catch (error) {
            if (error instanceof ForbiddenError) {
                res.status(403).json({ error: error.message, redirectUrl: settings.urls.frontend })
                return
            }
            logger.error("Failed to switch organization", { error, userId: user.id, organizationId })
            res.status(500).json({ error: "Failed to switch organization.", redirectUrl: settings.urls.frontend })
        }
    }

    async getLogoUploadUrl(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        if (!user.roles?.includes("admin")) {
            res.status(403).json({ error: "Only admins can upload organization logos" })
            return
        }
        if (!user.organizationId) {
            res.status(400).json({ error: "No organization" })
            return
        }

        const { contentType } = logoUploadUrlQuerySchema.parse(req.query)
        try {
            const uploadUrl = await getLogoUploadUrlForOrganization(user.organizationId, contentType)
            res.json({ uploadUrl })
        } catch (error) {
            if (error instanceof BadRequestError) {
                res.status(400).json({ error: error.message })
                return
            }
            logger.error("Failed to generate logo upload URL", { error, userId: user.id, organizationId: user.organizationId })
            res.status(500).json({ error: "Failed to generate upload URL" })
        }
    }

    async getLogoUrl(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        const { organizationId } = logoParamsSchema.parse(req.params)
        try {
            const logoUrl = await getLogoUrlForOrganization(organizationId)
            res.json({ logoUrl })
        } catch (error) {
            logger.error("Failed to get logo URL", { error, userId: user.id, organizationId })
            res.status(500).json({ error: "Failed to get logo URL" })
        }
    }

    async updateOrganization(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        if (!user.roles?.includes("admin")) {
            res.status(403).json({ error: "Only admins can update organization settings" })
            return
        }
        if (!user.organizationId) {
            res.status(400).json({ error: "No organization" })
            return
        }

        const { name, executionRegion } = organizationUpdateRequestSchema.parse(req.body)
        try {
            const [organization, regionResult] = await Promise.all([
                name === undefined ? getOrganizationDetails(this.workos, user.organizationId) : updateOrganizationName(this.workos, user.organizationId, name, user.id),
                executionRegion === undefined
                    ? getOrCreateOrganizationExecutionRegion(user.organizationId).then(region => ({ executionRegion: region, previousExecutionRegion: region, changed: false }))
                    : setOrganizationExecutionRegion(user.organizationId, executionRegion)
            ])

            if (regionResult.changed) {
                logger.info("Organization execution region updated", {
                    organizationId: user.organizationId,
                    userId: user.id,
                    previousExecutionRegion: regionResult.previousExecutionRegion,
                    executionRegion: regionResult.executionRegion
                })
                analytics.capture(user.id, AnalyticsEvent.ORGANIZATION_EXECUTION_REGION_SET, {
                    organizationId: user.organizationId,
                    previousExecutionRegion: regionResult.previousExecutionRegion,
                    executionRegion: regionResult.executionRegion,
                    source: "settings"
                })
                analytics.groupIdentify(user.organizationId, { executionRegion: regionResult.executionRegion })
            }

            res.json({ ...organization, executionRegion: regionResult.executionRegion })
        } catch (error) {
            logger.error("Failed to update organization", { error, userId: user.id, organizationId: user.organizationId })
            res.status(500).json({ error: "Failed to update organization" })
        }
    }
}
