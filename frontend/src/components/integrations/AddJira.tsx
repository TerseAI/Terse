import { useState } from "react";
import { BackendProvider } from "../../services/backend";
import { IntegrationCard } from "./IntegrationCard";
import { useIntegrations } from "../../context/Integrations";
import posthog from "posthog-js";
import { PosthogEvents } from "../../utility/PosthogEvents";
import { useAuth } from "../../services/auth";

interface AddJiraProps {
    onIntegrationChange: () => Promise<void>;
}

export function AddJira({ onIntegrationChange }: AddJiraProps) {
    const { hasJira } = useIntegrations();
    const [key, setKey] = useState<string>('');
    const [baseUrl, setBaseUrl] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        setError(null);
        setIsLoading(true);
        e.preventDefault();
        try {
            await BackendProvider.setJiraApiKey(email, baseUrl, key);
            setKey(key ?? '');
            setBaseUrl(baseUrl ?? '');
            setEmail(email ?? '');
            setError(null);
            posthog.capture(PosthogEvents.USER_INTEGRATED_JIRA, {
                email: user?.email || 'unknown',
            }); 
            await onIntegrationChange();
        } catch (error) {
            console.error('Error setting Linear API key:', error);
            setError('Invalid Jira credentials');
        } finally {
            setIsLoading(false);
        }
    }

    const handleDisconnect = async () => {
        try {
            await BackendProvider.deleteJiraApiKey();
            setKey('');
            setBaseUrl('');
            setEmail('');
            posthog.capture(PosthogEvents.USER_DISCONNECTED_JIRA, {
                email: user?.email || 'unknown',
            });     
            await onIntegrationChange();
        } catch (error) {
            console.error('Error deleting Jira API key:', error);
        }
    }

    const connectButton = (
        <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                    {error}
                </div>
            )}
            <input 
                type="text" 
                placeholder="Enter your Jira API key" 
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            />
            <input 
                type="text" 
                placeholder="Enter your Jira workspace URL" 
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            />
            <input 
                type="text" 
                placeholder="Enter your Jira email. Must match the email in your Jira account." 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            />
            <button 
                type="submit" 
                disabled={isLoading || !key.trim() || !baseUrl.trim() || !email.trim()}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? 'Connecting...' : 'Connect Jira'}
            </button>
        </form>
    );

    return (
        <IntegrationCard
            title="Jira API Key"
            description="Connect your Jira workspace to manage tickets"
            isConnected={hasJira}
            isLoading={false}
            connectionInfo={hasJira ? `API Key configured for ${email} on ${baseUrl}` : undefined}
            onDisconnect={handleDisconnect}
            connectButton={connectButton}
            icon={
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13A2.46 2.46 0 0 0 9.9 18.24a2.478 2.478 0 0 0 2.47-2.47 2.46 2.46 0 0 0-2.47-2.47H5.232a2.46 2.46 0 0 1-2.47-2.47 2.46 2.46 0 0 1 2.47-2.47h6.339a5.218 5.218 0 0 0 5.232-5.215 5.218 5.218 0 0 0-5.232-5.215H5.232a5.218 5.218 0 0 0-5.232 5.215h11.571a2.46 2.46 0 0 1 2.47 2.47 2.46 2.46 0 0 1-2.47 2.47z"/>
                </svg>
            }
        />
    )
}