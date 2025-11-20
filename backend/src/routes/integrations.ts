import { Request, Response } from "express";
import { INTEGRATION_REGISTRY } from "../integrations/abstract/IntegrationRegistry";
import { 
    Integration,
    isOAuthIntegrationInstallation
} from "../integrations/abstract/Integration";
import { OAuthInstallationDetails } from "../shared/types";
import { IntegrationDetails, IntegrationInstance, IntegrationType } from "../shared/Integrations";
import { convertIntegrationTypeToPrismaIntegrationType, convertPrismaIntegrationTypeToIntegrationType } from "../utility/typeConverters";


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

        const userId = req.session.user.id;
        const installationDetails = await getInstallationInformation(integrationType as IntegrationType, userId);
        res.json(installationDetails);
    } catch (error: any) {
        console.error('Error getting installation details:', error);
        res.status(500).json({ error: error.message || 'Failed to get installation details' });
    }
}

const getInstallationInformation = async (integration: IntegrationType, userId: string): Promise<OAuthInstallationDetails> => {
    const integrationInstance = INTEGRATION_REGISTRY.find(instance => instance.integrationType === integration);
    if (!integrationInstance) {
        throw new Error(`Integration ${integration} not found`);
    }
    
    if (isOAuthIntegrationInstallation(integrationInstance)) {
        return await integrationInstance.getInstallationUrl(userId);
    }
    
    throw new Error(`Integration ${integration} does not support installation`);
}

export async function getActiveIntegrations(req: Request, res: Response) {
    if (!req.session?.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const userId = req.session.user.id;

    const activeIntegrations: IntegrationType[] = INTEGRATION_REGISTRY
        .filter(integration => integrationHasInstances(integration, userId))
        .map(integration => integration.integrationType);

    res.json(activeIntegrations);
}

async function integrationHasInstances(integration: Integration<IntegrationInstance, any, IntegrationDetails>, userId: string): Promise<boolean> {
    return (await integration.getInstancesForUser(userId)).length > 0;
}