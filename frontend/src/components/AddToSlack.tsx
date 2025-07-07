import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { IntegrationCard } from "./IntegrationCard";
import { Integration, useIntegrations } from "../context/Integrations";

export function AddToSlack() {
    const { addIntegration, removeIntegration } = useIntegrations();
    const [teamName, setTeamName] = useState<string | null>(null);
    const [slackOAuthUrl, setSlackOAuthUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Load both Slack integration status and OAuth URL in parallel
        Promise.all([
            BackendProvider.getCurrentSlackIntegration(),
            BackendProvider.requestSlackOAuthUrl()
        ])
        .then(([integrationResult, oauthResult]) => {
            setTeamName(integrationResult.teamName);
            setSlackOAuthUrl(oauthResult.url);
            addIntegration(Integration.SLACK);
        })
        .catch((error) => {
            console.error('Error fetching Slack integration:', error);
        })
        .finally(() => {
            setIsLoading(false);
        });
    }, []);

    const connectButton = slackOAuthUrl ? (
        <a
            href={slackOAuthUrl}
            className="inline-flex items-center justify-center w-full px-3 py-2 text-sm font-medium text-white bg-[#4A154B] rounded-md hover:bg-[#3a0f3a] focus:outline-none focus:ring-2 focus:ring-[#4A154B] focus:ring-offset-2 transition-colors"
            target="_blank"
            rel="noopener noreferrer"
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                viewBox="0 0 122.8 122.8"
            >
                <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
                <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
                <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
                <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
            </svg>
            Add to Slack
        </a>
    ) : (
        <div className="w-full px-3 py-2 text-sm text-gray-500 bg-gray-100 rounded-md">
            Loading...
        </div>
    );

    return (
        <IntegrationCard
            title="Slack Workspace"
            description="Connect your Slack workspace to receive notifications"
            isConnected={!!teamName}
            isLoading={isLoading}
            connectionInfo={teamName ? `Connected to ${teamName}` : undefined}
            connectButton={connectButton}
            icon={
                <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 122.8 122.8"
            >
                <path d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z" fill="#e01e5a" />
                <path d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z" fill="#36c5f0" />
                <path d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z" fill="#2eb67d" />
                <path d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z" fill="#ecb22e" />
            </svg>
            }
        />
    );
}