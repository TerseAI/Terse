import { Request, Response } from "express";
import { INTEGRATION_REGISTRY } from "../integrations/abstract/IntegrationRegistry";
import { 
    Integration,
    isOAuthIntegrationInstallation
} from "../integrations/abstract/Integration";
import { OAuthInstallationDetails } from "../shared/types";
import { InstallationOptionsFor, IntegrationDetails, IntegrationInstance, IntegrationType, IntegrationWithStatus } from "../shared/Integrations";
import logger from "../logger";


export const getIntegrationInstallationDetails = async (req: Request, res: Response) => {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }

    try {
        const { integrationType } = req.params;
        if (!integrationType) {
            res.status(400).json({ error: 'integrationType parameter is required' });
            return;
        }

        const options = req.query.options 
            ? JSON.parse(decodeURIComponent(req.query.options as string))
            : undefined;

        const userId = req.session.user.id;
        const installationDetails = await getInstallationInformation(integrationType as IntegrationType, userId, options);
        res.json(installationDetails);
    } catch (error: any) {
        logger.error('Error getting installation details', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, integrationType: req.params.integrationType, userId: req.session?.user?.id });
        res.status(500).json({ error: error.message || 'Failed to get installation details' });
    }
}

const getInstallationInformation = async (integration: IntegrationType, userId: string, options: InstallationOptionsFor<IntegrationType>): Promise<OAuthInstallationDetails> => {
    const integrationInstance = INTEGRATION_REGISTRY.find(instance => instance.integrationType === integration);
    if (!integrationInstance) {
        throw new Error(`Integration ${integration} not found`);
    }
    
    if (isOAuthIntegrationInstallation<typeof integration>(integrationInstance)) {
        return await integrationInstance.getInstallationUrl(userId, options);
    }
    
    throw new Error(`Integration ${integration} does not support installation`);
}

export async function getAllIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const userId = req.session.user.id;

    const hasInstancesResults = await Promise.all(
        INTEGRATION_REGISTRY.map(integration => integrationHasInstances(integration, userId))
    );

    const integrations: IntegrationWithStatus[] = INTEGRATION_REGISTRY.map((integration, index) => ({
        integrationType: integration.integrationType,
        isActive: hasInstancesResults[index],
    }));

    res.json(integrations);
}

// Keep for backwards compatibility
export async function getActiveIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const userId = req.session.user.id;

    const hasInstancesResults = await Promise.all(
        INTEGRATION_REGISTRY.map(integration => integrationHasInstances(integration, userId))
    );

    const activeIntegrations: IntegrationType[] = INTEGRATION_REGISTRY
        .filter((_, index) => hasInstancesResults[index])
        .map(integration => integration.integrationType);

    res.json(activeIntegrations);
}

async function integrationHasInstances(integration: Integration<IntegrationInstance, any, IntegrationDetails>, userId: string): Promise<boolean> {
    return (await integration.getInstancesForUser(userId)).length > 0;
}