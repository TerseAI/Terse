import { useState } from "react";
import { useAuth } from "../../../services/auth";
import { useIntegrations } from "../../../context/Integrations";
import { IntegrationCard } from "../IntegrationCard";
import { BackendProvider } from "../../../services/backend";
import { PosthogEvents } from "../../../utility/PosthogEvents";
import posthog from "posthog-js";

interface AddNotionProps {
    onIntegrationChange: () => Promise<void>;
}

export function AddNotion({ onIntegrationChange }: AddNotionProps) {
    const { hasNotion} = useIntegrations();
    const [integrationToken, setIntegrationToken] = useState<string>('');
    const [databaseUrl, setDatabaseUrl] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        setError(null);
        setIsLoading(true);
        e.preventDefault();
        try {
            const databaseId = getDatabaseIdFromUrl(databaseUrl);
            // await BackendProvider.setLinearApiKey(input);
            setIntegrationToken('');
            setDatabaseUrl('');
            setError(null);
            posthog.capture(PosthogEvents.USER_INTEGRATED_NOTION, {
                email: user?.email || 'unknown',
            });
            await onIntegrationChange();
        } catch (error) {
            console.error('Error setting Linear API key:', error);
            setError('Invalid Integration Token or Database URL');
        } finally {
            setIsLoading(false);
        }
    }

    const connectButton = (
        <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                    {error}
                </div>
            )}
            <div className="grid grid-flow-row gap-4">
                <input
                    type="text"
                    placeholder="Enter your Notion integration token"
                    value={integrationToken}
                    onChange={(e) => setIntegrationToken(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                <input
                    type="text"
                    placeholder="Paste your Notion Database URL"
                    value={databaseUrl}
                    onChange={(e) => setDatabaseUrl(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                    type="submit"
                    disabled={isLoading || !integrationToken.trim() || !databaseUrl.trim()}
                    className="px-3 py-2 text-sm font-medium text-[theme(text-primary)] bg-[theme(background-elevated)] rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? 'Connecting...' : 'Connect Notion'}
                </button>
            </div>
        </form>
    );

    const handleDisconnect = async () => {
        try {
            // await BackendProvider.deleteLinearApiKey();
            setIntegrationToken('');
            setDatabaseUrl('');
            setError(null);
            await onIntegrationChange();
            posthog.capture(PosthogEvents.USER_DISCONNECTED_LINEAR, {
                email: user?.email || 'unknown',
            });
        } catch (error) {
            console.error('Error deleting Linear API key:', error);
        }
    }

    return (
        <IntegrationCard
            title="Notion Integration"
            description="Connect your Notion workspace to manage tickets"
            isConnected={hasNotion}
            isLoading={false}
            connectionInfo={hasNotion ? "Integration Token and Database URL configured" : undefined}
            onDisconnect={handleDisconnect}
            connectButton={connectButton}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933l3.222-.187zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" fill="currentColor"/>
                </svg>
            }
        />
    )
}

// Helper function to get the database ID from the URL
function getDatabaseIdFromUrl(url: string): string {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const databaseId = pathname.split('/').pop();
    if (!databaseId) {
        throw new Error('No database ID found in URL');
    }
    return databaseId;
}