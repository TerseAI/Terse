import { Request, Response } from "express"
import { IntegrationType } from "terse-types/Integrations"

import logger from "../../common/logger"

import {
    IntegrationInstallationUnsupportedError,
    IntegrationNotConnectedError,
    IntegrationNotFoundError,
    decodeOptionalStatePayload,
    disconnectIntegrationForOrganization,
    getInstallationInformation,
    listActiveIntegrationsForOrganization,
    listIntegrationsForOrganization
} from "./service"

export async function getIntegrationInstallationDetails(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })

    try {
        const { integrationType } = req.params
        if (!integrationType) return res.status(400).json({ error: "integrationType parameter is required" })

        const options = req.query.options ? JSON.parse(decodeURIComponent(req.query.options as string)) : undefined
        const additionalStatePayload = decodeOptionalStatePayload(req.query.state as string | undefined, integrationType, req.session.user.id)

        const userId = req.session.user.id
        const organizationId = req.session.user.organizationId
        const installationDetails = await getInstallationInformation(integrationType as IntegrationType, userId, organizationId, options, additionalStatePayload, req, res)
        res.json(installationDetails)
    } catch (error: unknown) {
        if (error instanceof IntegrationNotFoundError) return res.status(404).json({ error: error.message })
        if (error instanceof IntegrationInstallationUnsupportedError) return res.status(400).json({ error: error.message })
        logger.error("Error getting installation details", { error, integrationType: req.params.integrationType, userId: req.session?.user?.id })
        res.status(500).json({ error: "Failed to get installation details" })
    }
}

export async function getAllIntegrations(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const organizationId = req.session.user.organizationId
    const integrations = await listIntegrationsForOrganization(organizationId)
    res.json(integrations)
}

export async function disconnectIntegration(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })

    const { integrationType } = req.params
    try {
        await disconnectIntegrationForOrganization(integrationType, req.session.user.organizationId)
        res.json({ success: true })
    } catch (error: unknown) {
        if (error instanceof IntegrationNotFoundError) return res.status(404).json({ error: error.message })
        if (error instanceof IntegrationNotConnectedError) return res.status(400).json({ error: error.message })
        logger.error("Error disconnecting integration", { error, integrationType, userId: req.session.user.id, organizationId: req.session.user.organizationId })
        res.status(500).json({ error: "Failed to disconnect integration" })
    }
}

export async function getActiveIntegrations(req: Request, res: Response) {
    if (!req.session?.user) return res.status(401).json({ error: "Unauthorized" })
    const organizationId = req.session.user.organizationId
    const activeIntegrations = await listActiveIntegrationsForOrganization(organizationId)
    res.json(activeIntegrations)
}
