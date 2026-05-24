import { Request, Response } from "express"

import OrganizationProvider, { Membership } from "./OrganizationProvider"

export class LocalOrganizationProvider implements OrganizationProvider {
    async getOrganization(_organizationId: string): Promise<string> {
        // TODO: return the single self-host org from local_organizations
        return ""
    }

    async getMembership(_externalUserId: string, _organizationId: string): Promise<Membership | null> {
        // TODO: return { organizationName, roles: ["admin"] } from local_memberships (single-org mode)
        return null
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
