import { useState } from "react";
import { BackendProvider } from "../../../services/backend";
import { IntegrationCard } from "../IntegrationCard";
import { useIntegrations } from "../../../context/Integrations";
import posthog from "posthog-js";
import { PosthogEvents } from "../../../utility/PosthogEvents";
import { useAuth } from "../../../services/auth";

interface AddLinearProps {
    onIntegrationChange: () => Promise<void>;
}

export function AddLinear({ onIntegrationChange }: AddLinearProps) {
    const { hasLinear } = useIntegrations();
    const [input, setInput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        setError(null);
        setIsLoading(true);
        e.preventDefault();
        try {
            await BackendProvider.setLinearApiKey(input);
            setInput('');
            setError(null);
            posthog.capture(PosthogEvents.USER_INTEGRATED_LINEAR, {
                email: user?.email || 'unknown',
            });
            await onIntegrationChange();
        } catch (error) {
            console.error('Error setting Linear API key:', error);
            setError('Invalid API Key');
        } finally {
            setIsLoading(false);
        }
    }

    const handleDisconnect = async () => {
        try {
            await BackendProvider.deleteLinearApiKey();
            setInput('');
            setError(null);
            await onIntegrationChange();
            posthog.capture(PosthogEvents.USER_DISCONNECTED_LINEAR, {
                email: user?.email || 'unknown',
            });
        } catch (error) {
            console.error('Error deleting Linear API key:', error);
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
                    placeholder="Enter your Linear API key"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="px-3 py-2 text-sm font-medium text-[theme(text-primary)] bg-[theme(background-elevated)] rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? 'Connecting...' : 'Connect Linear'}
                </button>
            </div>
        </form>
    );

    return (
        <IntegrationCard
            title="Linear API Key"
            description="Connect your Linear workspace to manage tickets"
            isConnected={hasLinear}
            isLoading={false}
            connectionInfo={hasLinear ? "API Key configured" : undefined}
            onDisconnect={handleDisconnect}
            connectButton={connectButton}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 100 100"><path fill="#E6EDF3" d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228ZM.00189135 46.8891c-.01764375.2833.08887215.5599.28957165.7606L52.3503 99.7085c.2007.2007.4773.3075.7606.2896 2.3692-.1476 4.6938-.46 6.9624-.9259.7645-.157 1.0301-1.0963.4782-1.6481L2.57595 39.4485c-.55186-.5519-1.49117-.2863-1.648174.4782-.465915 2.2686-.77832 4.5932-.92588465 6.9624ZM4.21093 29.7054c-.16649.3738-.08169.8106.20765 1.1l64.77602 64.776c.2894.2894.7262.3742 1.1.2077 1.7861-.7956 3.5171-1.6927 5.1855-2.684.5521-.328.6373-1.0867.1832-1.5407L8.43566 24.3367c-.45409-.4541-1.21271-.3689-1.54074.1832-.99132 1.6684-1.88843 3.3994-2.68399 5.1855ZM12.6587 18.074c-.3701-.3701-.393-.9637-.0443-1.3541C21.7795 6.45931 35.1114 0 49.9519 0 77.5927 0 100 22.4073 100 50.0481c0 14.8405-6.4593 28.1724-16.7199 37.3375-.3903.3487-.984.3258-1.3542-.0443L12.6587 18.074Z" /></svg>
            }
        />
    )
}

