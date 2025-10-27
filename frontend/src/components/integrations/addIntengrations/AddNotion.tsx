import posthog from "posthog-js";
import { useEffect, useState } from "react";
import { useIntegrations } from "../../../context/Integrations";
import { useAuth } from "../../../services/auth";
import { BackendProvider } from "../../../services/backend";
import { PosthogEvents } from "../../../utility/PosthogEvents";
import { IntegrationCard } from "../IntegrationCard";

interface AddNotionProps {
    onIntegrationChange: () => Promise<void>;
}

interface NotionDatabase {
    id: string;
    title: string;
    url: string;
}

export function AddNotion({ onIntegrationChange }: AddNotionProps) {
    const { hasNotion } = useIntegrations();
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [databases, setDatabases] = useState<NotionDatabase[]>([]);
    const [selectedDatabaseId, setSelectedDatabaseId] = useState<string>("");
    const { user } = useAuth();

    // Fetch databases on mount if user has Notion integration
    useEffect(() => {
        if (hasNotion) {
            handleFetchDatabases();
        } else {
            // Clear local state when integration is disconnected
            setDatabases([]);
            setSelectedDatabaseId('');
            setError(null);
        }
    }, [hasNotion]);

    const handleFetchDatabases = async () => {
        try {
            setIsLoading(true);
            const response = await BackendProvider.getNotionDatabases();
            setDatabases(response.databases);
            setSelectedDatabaseId(response.selectedDatabaseId || '');
            setError(null);
        } catch (error) {
            console.error('Error fetching databases:', error);
            setError('Failed to fetch databases. Please try reconnecting.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnectNotion = async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Get OAuth URL from backend
            const { url } = await BackendProvider.requestNotionOAuthUrl();

            // Open OAuth URL in new window
            const width = 600;
            const height = 700;
            const left = window.screen.width / 2 - width / 2;
            const top = window.screen.height / 2 - height / 2;

            window.open(
                url,
                'Notion OAuth',
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
            );

            // Start polling for completion (popup will auto-close on success)
            const pollInterval = setInterval(async () => {
                try {
                    await onIntegrationChange();
                    // Check if integration now exists
                    if (hasNotion) {
                        clearInterval(pollInterval);
                        await handleFetchDatabases();
                        setIsLoading(false);

                        // Track successful integration
                        posthog.capture(PosthogEvents.USER_INTEGRATED_NOTION, {
                            email: user?.email || 'unknown',
                        });
                    }
                } catch (error) {
                    // Still waiting for OAuth to complete
                }
            }, 2000);

            // Stop polling after 2 minutes
            setTimeout(() => {
                clearInterval(pollInterval);
                setIsLoading(false);
            }, 120000);
        } catch (error) {
            console.error('Error initiating Notion OAuth:', error);
            setError('Failed to start OAuth flow. Please try again.');
            setIsLoading(false);
        }
    };

    const handleDatabaseChange = async (databaseId: string) => {
        if (!databaseId) {
            return;
        }

        try {
            setSelectedDatabaseId(databaseId);
            await BackendProvider.setNotionDatabase(databaseId);
            setError(null);
            await onIntegrationChange();
        } catch (error) {
            console.error('Error setting Notion database:', error);
            setError('Failed to save database selection. Please try again.');
        }
    };

    const handleDisconnect = async () => {
        try {
            setIsLoading(true);
            await BackendProvider.deleteNotionIntegration();
            // Clear local state immediately
            setDatabases([]);
            setSelectedDatabaseId('');
            setError(null);
            // Force integration refresh
            await onIntegrationChange();
            posthog.capture(PosthogEvents.USER_DISCONNECTED_NOTION, {
                email: user?.email || 'unknown',
            });
        } catch (error) {
            console.error('Error deleting Notion integration:', error);
            setError('Failed to disconnect. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const connectButton = (
        <div className="space-y-3">
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                    {error}
                </div>
            )}
            <button
                type="button"
                onClick={handleConnectNotion}
                disabled={isLoading}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? 'Connecting...' : 'Connect with Notion'}
            </button>
        </div>
    );

    const optionsSection = hasNotion ? (
        <div className="space-y-3">
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                    {error}
                </div>
            )}
            {databases.length > 0 && (
                <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                        Database:
                    </label>
                    <select
                        value={selectedDatabaseId}
                        onChange={(e) => handleDatabaseChange(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                    >
                        <option value="">-- Select a database --</option>
                        {databases.map((db) => (
                            <option key={db.id} value={db.id}>
                                {db.title}
                            </option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    ) : undefined;

    return (
        <IntegrationCard
            title="Notion Integration"
            description="Connect your Notion workspace to manage tickets"
            isConnected={hasNotion}
            isLoading={isLoading}
            connectionInfo={hasNotion ? "Connected" : undefined}
            onDisconnect={handleDisconnect}
            connectButton={connectButton}
            options={optionsSection}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933l3.222-.187zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" fill="currentColor" />
                </svg>
            }
        />
    );
}
