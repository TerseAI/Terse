import { useEffect, useState } from "react";
import { BackendProvider } from "@/services/backend";
import { Integration } from "@/context/Integrations";

export function useOAuthUrl(integration: Integration) {
    const [oauthUrl, setOauthUrl] = useState<string | null>(null);

    useEffect(() => {
        const fetchOAuthUrl = async () => {
            try {
                let response: { url: string };

                switch (integration) {
                    case Integration.GMAIL:
                        response = await BackendProvider.requestGmailOAuthUrl();
                        break;
                    case Integration.NOTION:
                        response = await BackendProvider.requestNotionOAuthUrl();
                        break;
                    case Integration.SLACK:
                        response = await BackendProvider.requestSlackOAuthUrl();
                        break;
                    case Integration.GITHUB:
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

