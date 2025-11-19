import { useState } from 'react';
import { IntegrationType } from "@/shared/Integrations"
import { BackendProvider } from '../services/backend';

export function useOAuthConnection(integrationType: IntegrationType) {
    const [isConnecting, setIsConnecting] = useState(false);

    const connect = async () => {
        setIsConnecting(true);
        try {
            const installationDetails = await BackendProvider.getIntegrationInstallationDetails(integrationType);
            
            if (installationDetails?.oauthUrl) {
                window.open(installationDetails.oauthUrl, 'oauth-popup', 'width=600,height=700');
            } else {
                console.error('OAuth URL not available for this integration type');
            }
        } catch (error) {
            console.error('Error initiating OAuth:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    return { connect, isConnecting };
}

