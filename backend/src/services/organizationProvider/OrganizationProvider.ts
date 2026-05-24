import { Request, Response } from "express"
import { Membership, Organization } from "terse-types/types"

interface OrganizationProvider {
    // Resolve Ids
    getOrganization(organizationId: string): Promise<Organization | null>
    getMembership(externalUserId: string, organizationId: string): Promise<Membership | null>
    getMemberships(externalUserId: string): Promise<Membership[]>

    // Request handlers
    createOrganization(req: Request, res: Response): Promise<void>
    getCurrentOrganization(req: Request, res: Response): Promise<void>
    getUserOrganizations(req: Request, res: Response): Promise<void>
    switchOrganization(req: Request, res: Response): Promise<void>
    getLogoUploadUrl(req: Request, res: Response): Promise<void>
    getLogoUrl(req: Request, res: Response): Promise<void>
    updateOrganization(req: Request, res: Response): Promise<void>
}

export default OrganizationProvider
