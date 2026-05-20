import { Request, Response } from "express"

import { isFormIntegrationInstallation, isOAuthIntegrationInstallation } from "../integrations/abstract/Integration"
import { INTEGRATION_REGISTRY } from "../integrations/abstract/IntegrationRegistry"
import logger from "../logger"

/**
 * GET /sdk/integrations/:integrationType/fields
 *
 * Returns the field definitions for a given integration type.
 * - Form integrations (Datadog, PostHog, etc.): returns form fields (text, password, etc.)
 * - OAuth integrations (Slack, etc.): returns configuration fields (radio, select, etc.)
 */
export async function handleSdkIntegrationFields(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const { integrationType } = req.params
    const integration = INTEGRATION_REGISTRY.find(i => i.integrationType === integrationType)

    if (!integration) {
        res.status(404).json({ error: `Integration '${integrationType}' not found` })
        return
    }

    if (isFormIntegrationInstallation(integration)) {
        res.json({ installationType: "form", fields: integration.getFormFields(), setup: integration.getFormSetup?.() })
        return
    }

    if (isOAuthIntegrationInstallation(integration)) {
        res.json({ installationType: "oauth", fields: integration.getConfigurationFields() })
        return
    }

    res.json({ installationType: "unknown", fields: [] })
}

/**
 * POST /sdk/integrations/:integrationType/form-submit
 *
 * Generic form submission endpoint that dispatches to the correct integration manager.
 * Body: { formValues: Record<string, string> }
 */
export async function handleSdkIntegrationFormSubmit(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: "Unauthorized" })
        return
    }

    const { integrationType } = req.params
    const integration = INTEGRATION_REGISTRY.find(i => i.integrationType === integrationType)

    if (!integration) {
        res.status(404).json({ error: `Integration '${integrationType}' not found` })
        return
    }

    if (!isFormIntegrationInstallation(integration)) {
        res.status(400).json({ error: `Integration '${integrationType}' does not support form submission` })
        return
    }

    try {
        const { id: userId, organizationId } = req.session.user
        const result = await integration.processFormSubmission({
            userId,
            organizationId,
            formValues: req.body?.formValues || {}
        })

        if (!result.success) {
            res.status(result.statusCode || 400).json(result)
            return
        }

        res.status(result.statusCode ?? 200).json(result)
    } catch (error) {
        logger.error("[SDK] Error submitting integration form", { error, integrationType })
        res.status(500).json({ error: "Failed to process integration form" })
    }
}
