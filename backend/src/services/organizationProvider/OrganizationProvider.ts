import { Request, Response } from "express"
import { Role } from "terse-types/types"

export interface Membership {
    organizationName: string
    roles: Role[]
}

interface OrganizationProvider {
    // Resolve Ids
    getOrganization(organizationId: string): Promise<string>
    /** Returns null when the user isn't an active member of the given org. */
    getMembership(externalUserId: string, organizationId: string): Promise<Membership | null>

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
