import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { IntegrationCard } from "./IntegrationCard";
import { Integration, useIntegrations } from "../context/Integrations";

export function AddJira() {
    const { addIntegration, removeIntegration } = useIntegrations();
    const [jiraApiKey, setJiraApiKey] = useState<string | null>(null);
    const [input, setInput] = useState<string>('');
    const [baseUrl, setBaseUrl] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    useEffect(() => {
        BackendProvider.getJiraApiKey()
            .then(({ apiKey }) => {
                setJiraApiKey(apiKey);
                addIntegration(Integration.JIRA);
            })
            .catch((error) => {
                console.error('Error fetching Linear API key:', error);
            })
            .finally(() => {
                setIsInitialLoading(false);
            });
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        setError(null);
        setIsLoading(true);
        e.preventDefault();
        try {
            await BackendProvider.setJiraApiKey(baseUrl, input);
            setJiraApiKey(input);
            setBaseUrl(baseUrl);
            setInput('');
            setError(null);
        } catch (error) {
            console.error('Error setting Linear API key:', error);
            setError('Invalid API Key');
        } finally {
            setIsLoading(false);
        }
    }

    const handleDisconnect = () => {
        setJiraApiKey(null);
        setInput('');
        setError(null);
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            />
            <input 
                type="text" 
                placeholder="Enter your Jira workspace URL" 
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            />
            <button 
                type="submit" 
                disabled={isLoading || !input.trim()}
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
            isConnected={!!jiraApiKey}
            isLoading={isInitialLoading}
            connectionInfo={jiraApiKey ? "API Key configured" : undefined}
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