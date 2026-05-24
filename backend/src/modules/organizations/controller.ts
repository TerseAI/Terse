import { Request, Response } from "express"

import { getOrganizationProvider } from "../../services/organizationProvider"

export async function createOrganization(req: Request, res: Response) {
    getOrganizationProvider().createOrganization(req, res)
}

export async function getCurrentOrganization(req: Request, res: Response) {
    getOrganizationProvider().getCurrentOrganization(req, res)
}

export async function getUserOrganizations(req: Request, res: Response) {
    getOrganizationProvider().getUserOrganizations(req, res)
}

export async function switchOrganization(req: Request, res: Response) {
    getOrganizationProvider().switchOrganization(req, res)
}

export async function getLogoUploadUrl(req: Request, res: Response) {
    getOrganizationProvider().getLogoUploadUrl(req, res)
}

export async function getLogoUrl(req: Request, res: Response) {
    getOrganizationProvider().getLogoUrl(req, res)
}

export async function updateOrganization(req: Request, res: Response) {
    getOrganizationProvider().updateOrganization(req, res)
}
