import posthog from "posthog-js";
import { useState } from "react";
import { useIntegrations } from "../../../context/Integrations";
import { useAuth } from "../../../services/auth";
import { BackendProvider } from "../../../services/backend";
import { PosthogEvents } from "../../../utility/PosthogEvents";
import { IntegrationCard } from "../IntegrationCard";

function AddGmail() {
    const { hasGmail, isPolling, startPolling, refreshIntegrations } = useIntegrations();
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    const handleDisconnect = async () => {
        setIsLoading(true);
        try {
            await BackendProvider.deleteGmailIntegration();
            posthog.capture(PosthogEvents.USER_DISCONNECTED_GMAIL, {
                email: user?.email || 'unknown',
                integration: 'gmail'
            });
            await refreshIntegrations();
        } catch (error) {
            console.error('Error disconnecting Gmail:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const connectButton = (
        <button
            onClick={async () => {
                setIsLoading(true);
                try {
                    posthog.capture(PosthogEvents.USER_INTEGRATED_GMAIL, {
                        email: user?.email || 'unknown',
                    });
                    const { url } = await BackendProvider.requestGmailOAuthUrl();
                    window.open(url, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
                    startPolling();
                } catch (error) {
                    console.error('Error requesting Gmail OAuth URL:', error);
                } finally {
                    setIsLoading(false);
                }
            }}
            disabled={isLoading || isPolling}
            className="w-full px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? 'Opening Gmail...' :
                isPolling ? 'Checking connection...' :
                    'Connect to Gmail'}
        </button>
    );

    return (
        <IntegrationCard
            title="Gmail"
            description="Connect your Gmail account to ingest emails"
            isConnected={hasGmail}
            isLoading={isLoading || isPolling}
            connectionInfo={isPolling ? "Checking connection..." : hasGmail ? "Connected" : undefined}
            onDisconnect={handleDisconnect}
            disconnectLabel="Disconnect Gmail"
            connectButton={connectButton}
            icon={
                <img src="/gmailIcon.png" alt="Gmail" className="w-8 h-6" />
            }
        />
    )
}

export default AddGmail;