import { useEffect, useState } from "react";
import { BackendProvider } from "@/services/backend";
import { IntegrationType } from "@/shared/Integrations"

export function useOAuthUrl(integration: IntegrationType) {
    const [oauthUrl, setOauthUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchOAuthUrl = async () => {
            try {
                let response: { url: string };

                switch (integration) {
                    case IntegrationType.GMAIL:
                        response = await BackendProvider.requestGmailOAuthUrl();
                        break;
                    case IntegrationType.NOTION:
                        response = await BackendProvider.requestNotionOAuthUrl();
                        break;
                    case IntegrationType.SLACK:
                        response = await BackendProvider.requestSlackOAuthUrl();
                        break;
                    case IntegrationType.GITHUB:
                        const githubResponse = await BackendProvider.requestGitHubAppInstallationUrl();
                        response = { url: githubResponse.installationUrl };
                        break;
                    default:
                        console.warn(`OAuth not supported for integration: ${integration}`);
                        return;
                }

                setOauthUrl(response.url);
            } catch (error) {
                console.error(`Error fetching OAuth URL for ${integration}:`, error);
            }
        };

        fetchOAuthUrl();
    }, [integration]);

    return oauthUrl;
}

