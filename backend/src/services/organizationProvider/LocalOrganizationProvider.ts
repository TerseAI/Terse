import { Request, Response } from "express"
import { Membership, Organization } from "terse-types/types"

import OrganizationProvider from "./OrganizationProvider"

export class LocalOrganizationProvider implements OrganizationProvider {
    async getOrganization(_organizationId: string): Promise<Organization | null> {
        // TODO: return the single self-host org from local_organizations
        return null
    }

    async getMembership(_externalUserId: string, _organizationId: string): Promise<Membership | null> {
        // TODO: return { organizationId, organizationName, roles: ["admin"] } from local_memberships (single-org mode)
        return null
    }

    async getMemberships(_externalUserId: string): Promise<Membership[]> {
        // TODO: return [the one membership] for the single self-host org
        return []
    }

    async createOrganization(req: Request, res: Response): Promise<void> {
        const { name } = req.body
    }

    async getCurrentOrganization(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async getUserOrganizations(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async switchOrganization(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async getLogoUploadUrl(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async getLogoUrl(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }

    async updateOrganization(req: Request, res: Response): Promise<void> {
        const { email, password } = req.body
    }
}
