import { Request, Response } from "express"

interface OrganizationProvider {
    createOrganization(req: Request, res: Response): Promise<void>
    getCurrentOrganization(req: Request, res: Response): Promise<void>
    getUserOrganizations(req: Request, res: Response): Promise<void>
    switchOrganization(req: Request, res: Response): Promise<void>
    getLogoUploadUrl(req: Request, res: Response): Promise<void>
    getLogoUrl(req: Request, res: Response): Promise<void>
    updateOrganization(req: Request, res: Response): Promise<void>
}

export default OrganizationProvider
