import { useState } from 'react';
import { BackendProvider } from '../services/backend';
import { IntegrationType } from "@/shared/Integrations"

export function useOAuthConnection(integrationType: IntegrationType) {
    const [isConnecting, setIsConnecting] = useState(false);

    const connect = async () => {
        setIsConnecting(true);
        try {
            let oauthUrl = '';

            switch (integrationType) {
                case IntegrationType.GMAIL:
                    const gmailResponse = await BackendProvider.requestGmailOAuthUrl();
                    oauthUrl = gmailResponse.url;
                    break;
                case IntegrationType.NOTION:
                    const notionResponse = await BackendProvider.requestNotionOAuthUrl();
                    oauthUrl = notionResponse.url;
                    break;
                case IntegrationType.SLACK:
                    const slackResponse = await BackendProvider.requestSlackOAuthUrl();
                    oauthUrl = slackResponse.url;
                    break;
                case IntegrationType.GITHUB:
                    const githubResponse = await BackendProvider.requestGitHubAppInstallationUrl();
                    oauthUrl = githubResponse.installationUrl;
                    break;
                case IntegrationType.FIGMA:
                    const figmaResponse = await BackendProvider.requestFigmaOAuthUrl();
                    oauthUrl = figmaResponse.url;
                    break;
                default:
                    console.error('OAuth not supported for this integration type');
                    return;
            }

            if (oauthUrl) {
                window.open(oauthUrl, 'oauth-popup', 'width=600,height=700');
            }
        } catch (error) {
            console.error('Error initiating OAuth:', error);
        } finally {
            setIsConnecting(false);
        }
    };

    return { connect, isConnecting };
}

