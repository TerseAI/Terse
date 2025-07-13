import { useState, useEffect } from "react";
import { BackendProvider } from "../services/backend";
import { IntegrationCard } from "./IntegrationCard";
import { useIntegrations } from "../context/Integrations";
import { PosthogEvents } from "../utility/PosthogEvents";
import posthog from "posthog-js";
import { useAuth } from "../services/auth";

interface AddToSlackProps {
    onIntegrationChange: () => Promise<void>;
}

export function AddToSlack({ onIntegrationChange }: AddToSlackProps) {
    const { hasSlack } = useIntegrations();
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    // Listen for Slack connection success
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data.type === 'SLACK_CONNECTED' && event.data.success) {
                console.log('Slack connected successfully:', event.data);
                onIntegrationChange();
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onIntegrationChange]);

    const connectButton = (
        <button
            onClick={async () => {
                setIsLoading(true);
                try {   
                    posthog.capture(PosthogEvents.USER_INTEGRATED_SLACK, {
                        email: user?.email || 'unknown',
                    });
                    const { url } = await BackendProvider.requestSlackOAuthUrl();
                    window.open(url, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
                } catch (error) {
                    console.error('Error requesting Slack OAuth URL:', error);
                } finally {
                    setIsLoading(false);
                }
            }}
            disabled={isLoading}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? 'Opening Slack...' : 'Connect to Slack'}
        </button>
    );

    const onDisconnect = async () => {
        try {
            posthog.capture(PosthogEvents.USER_DISCONNECTED_JIRA, {
                email: user?.email || 'unknown',
            });
            const { url } = await BackendProvider.requestSlackOAuthUrl();
            window.open(url, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
        } catch (error) {
            console.error('Error requesting Slack OAuth URL:', error);
        }
    }

    return (
        <IntegrationCard
            title="Slack Workspace"
            description="Connect your Slack workspace to receive notifications about ticket updates"
            isConnected={hasSlack}
            isLoading={false}
            connectionInfo={hasSlack ? "Workspace connected" : undefined}
            connectButton={connectButton}
            onDisconnect={onDisconnect}
            disconnectLabel="Manage Slack App"
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