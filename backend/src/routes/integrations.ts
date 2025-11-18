import { Request, Response } from "express";
import { IntegrationType } from "@prisma/client";
import { IntegrationRegistry } from "../integrations/abstract/IntegrationRegistry";
import { 
    isOAuthIntegrationInstallation
} from "../integrations/abstract/Integration";
import { OAuthInstallationDetails } from "../shared/types";


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
        const installationDetails = getInstallationInformation(integrationType as IntegrationType, userId);
        res.json(installationDetails);
    } catch (error: any) {
        console.error('Error getting installation details:', error);
        res.status(500).json({ error: error.message || 'Failed to get installation details' });
    }
}

const getInstallationInformation = (integration: IntegrationType, userId: string): OAuthInstallationDetails => {
    const integrationInstance = IntegrationRegistry.find(instance => instance.integrationType === integration);
    if (!integrationInstance) {
        throw new Error(`Integration ${integration} not found`);
    }
    
    if (isOAuthIntegrationInstallation(integrationInstance)) {
        return integrationInstance.getInstallationUrl(userId);
    }
    
    throw new Error(`Integration ${integration} does not support installation`);
}