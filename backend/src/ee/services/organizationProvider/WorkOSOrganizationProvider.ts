import { Request, Response } from "express"

import OrganizationProvider from "../../../services/organizationProvider/OrganizationProvider"

export class WorkOSOrganizationProvider implements OrganizationProvider {
    async createOrganization(_req: Request, _res: Response): Promise<void> {
        // TODO: move existing createOrganization handler from modules/organizations/controller.ts
    }

    async getCurrentOrganization(_req: Request, _res: Response): Promise<void> {
        // TODO: move existing getCurrentOrganization handler
    }

    async getUserOrganizations(_req: Request, _res: Response): Promise<void> {
        // TODO: move existing getUserOrganizations handler
    }

    async switchOrganization(_req: Request, _res: Response): Promise<void> {
        // TODO: move existing switchOrganization handler
    }

    async getLogoUploadUrl(_req: Request, _res: Response): Promise<void> {
        // TODO: move existing getLogoUploadUrl handler
    }

    async getLogoUrl(_req: Request, _res: Response): Promise<void> {
        // TODO: move existing getLogoUrl handler
    }

    async updateOrganization(_req: Request, _res: Response): Promise<void> {
        // TODO: move existing updateOrganization handler
    }
}
