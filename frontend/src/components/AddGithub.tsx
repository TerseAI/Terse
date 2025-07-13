import { useState } from "react";
import { BackendProvider } from "../services/backend";
import { IntegrationCard } from "./IntegrationCard";
import { useIntegrations } from "../context/Integrations";
import { PosthogEvents } from "../utility/PosthogEvents";
import posthog from "posthog-js";
import { useAuth } from "../services/auth";

interface AddGithubProps {
    onIntegrationChange: () => Promise<void>;
}

export function AddGithub({ onIntegrationChange }: AddGithubProps) {
    const { hasGithub } = useIntegrations();
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    const connectButton = (
        <button
            onClick={async () => {
                setIsLoading(true);
                try {
                    posthog.capture(PosthogEvents.USER_INTEGRATED_GITHUB, {
                        email: user?.email || 'unknown',
                    });
                    const { installationUrl } = await BackendProvider.requestGitHubAppInstallationUrl();
                    window.open(installationUrl, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
                    // Refresh integrations after a short delay to allow for installation
                    setTimeout(() => {
                        onIntegrationChange();
                    }, 2000);
                } catch (error) {
                    console.error('Error requesting GitHub app installation:', error);
                } finally {
                    setIsLoading(false);
                }
            }}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? 'Installing...' : 'Install GitHub App'}
        </button>
    );

    const onDisconnect = async () => {
        try {
            posthog.capture(PosthogEvents.USER_DISCONNECTED_GITHUB, {
                email: user?.email || 'unknown',
            });
            const { installationUrl } = await BackendProvider.requestGitHubAppInstallationUrl();
            window.open(installationUrl, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
            // Refresh integrations after a short delay
            setTimeout(() => {
                onIntegrationChange();
            }, 2000);
        } catch (error) {
            console.error('Error requesting GitHub app installation:', error);
        }
    }

    return (
        <IntegrationCard
            title="GitHub Repository"
            description="Connect your GitHub repository to track issues and pull requests"
            isConnected={hasGithub}
            isLoading={false}
            connectionInfo={hasGithub ? "Repository connected" : undefined}
            connectButton={connectButton}
            onDisconnect={onDisconnect}
            disconnectLabel="Manage GitHub App"
            icon={
                <svg className="w-4 h-4 text-gray-900" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
            }
        />
    )
}