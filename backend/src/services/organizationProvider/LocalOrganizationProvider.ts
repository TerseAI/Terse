import { Request, Response } from "express"

import OrganizationProvider from "./OrganizationProvider"

export class LocalOrganizationProvider implements OrganizationProvider {
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
