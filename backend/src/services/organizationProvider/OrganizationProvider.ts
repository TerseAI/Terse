import { Request, Response } from "express"

interface OrganizationProvider {
    // Resolve Ids
    getOrganization(organizationId: string): Promise<string>
    getMembershipId(externalUserId: string, organizationId: string): Promise<string>

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
