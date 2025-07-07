import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { IntegrationCard } from "./IntegrationCard";
import { Integration, useIntegrations } from "../context/Integrations";

export function AddLinear() {
    const { addIntegration, removeIntegration } = useIntegrations();
    const [linearApiKey, setLinearApiKey] = useState<string | null>(null);
    const [input, setInput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    useEffect(() => {
        BackendProvider.getLinearApiKey()
            .then(({ apiKey }) => {
                setLinearApiKey(apiKey);
                addIntegration(Integration.LINEAR);
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
            await BackendProvider.setLinearApiKey(input);
            setLinearApiKey(input);
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
        setLinearApiKey(null);
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
                placeholder="Enter your Linear API key" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
            />
            <button 
                type="submit" 
                disabled={isLoading || !input.trim()}
                className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                {isLoading ? 'Connecting...' : 'Connect Linear'}
            </button>
        </form>
    );

    return (
        <IntegrationCard
            title="Linear API Key"
            description="Connect your Linear workspace to manage tickets"
            isConnected={!!linearApiKey}
            isLoading={isInitialLoading}
            connectionInfo={linearApiKey ? "API Key configured" : undefined}
            onDisconnect={handleDisconnect}
            connectButton={connectButton}
            icon={
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
            }
        />
    )
}