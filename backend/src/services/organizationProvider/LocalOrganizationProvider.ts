import { Request, Response } from "express"
import { Membership, Organization, Role, organizationUpdateRequestSchema } from "terse-types/types"

import logger from "../../common/logger"
import { localAuthDb } from "../../loaders/prisma"

import OrganizationProvider from "./OrganizationProvider"

export class SingleOrgModeError extends Error {
    constructor() {
        super("Local self-host runs in single-organization mode; creating additional organizations is not supported.")
        this.name = "SingleOrgModeError"
    }
}

export class LocalOrganizationProvider implements OrganizationProvider {
    async getOrganization(organizationId: string): Promise<Organization | null> {
        const org = await localAuthDb().local_organizations.findUnique({ where: { id: organizationId } })
        if (!org) return null
        return { id: org.id, name: org.name }
    }

    async getMembership(externalUserId: string, organizationId: string): Promise<Membership | null> {
        const membership = await localAuthDb().local_memberships.findUnique({
            where: { identity_id_organization_id: { identity_id: externalUserId, organization_id: organizationId } },
            include: { organization: true }
        })
        if (!membership) return null
        return {
            organizationId: membership.organization_id,
            organizationName: membership.organization.name,
            roles: parseRoles(membership.roles)
        }
    }

    async getMemberships(externalUserId: string): Promise<Membership[]> {
        const memberships = await localAuthDb().local_memberships.findMany({
            where: { identity_id: externalUserId },
            include: { organization: true }
        })
        return memberships.map(m => ({
            organizationId: m.organization_id,
            organizationName: m.organization.name,
            roles: parseRoles(m.roles)
        }))
    }

    async createOrganization(_req: Request, res: Response): Promise<void> {
        res.status(400).json({ error: new SingleOrgModeError().message })
    }

    async getCurrentOrganization(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        const org = await this.getOrganization(user.organizationId)
        if (!org) {
            res.status(404).json({ error: "Organization not found" })
            return
        }
        res.json(org)
    }

    async getUserOrganizations(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        const memberships = await this.getMemberships(user.id)
        res.json({ organizations: memberships.map(m => ({ id: m.organizationId, name: m.organizationName })) })
    }

    async switchOrganization(_req: Request, res: Response): Promise<void> {
        // Single-org mode — nothing to switch to.
        res.json({ success: true })
    }

    async updateOrganization(req: Request, res: Response): Promise<void> {
        const user = req.session?.user
        if (!user) {
            res.status(401).json({ error: "Unauthorized" })
            return
        }
        try {
            const { name } = organizationUpdateRequestSchema.parse(req.body)
            const updated = await localAuthDb().local_organizations.update({
                where: { id: user.organizationId },
                data: { name: name.trim() }
            })
            res.json({ id: updated.id, name: updated.name })
        } catch (error) {
            logger.error("[LocalOrganizationProvider] updateOrganization failed", { error })
            res.status(500).json({ error: "Failed to update organization" })
        }
    }

    async getLogoUploadUrl(_req: Request, res: Response): Promise<void> {
        // Local mode has no remote logo storage. Frontend hides this option via feature flag.
        res.status(501).json({ error: "Logo upload not supported in local mode" })
    }

    async getLogoUrl(_req: Request, res: Response): Promise<void> {
        res.json({ logoUrl: null })
    }
}

function parseRoles(stored: string): Role[] {
    return stored
        .split(",")
        .map(s => s.trim())
        .filter((r): r is Role => r === "admin" || r === "user")
}
