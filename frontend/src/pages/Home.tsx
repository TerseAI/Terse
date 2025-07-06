import { useAuth } from "../services/auth";
import { ChatInterface } from "../components/chat/ChatInterface";
import { BackendProvider } from "../services/backend";
import { useEffect, useState } from "react";
import { AddToSlack } from "../components/AddToSlack";
import { AddGithub } from "../components/AddGithub";

function Home() {
    const { user, logout } = useAuth();

    return (
        <div className="flex h-screen bg-[#fafafa] text-gray-900">
            {/* Left Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-lg font-semibold text-gray-900">AI Product Owner</h1>
                            <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.display_name}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                        >
                            Sign out
                        </button>
                    </div>
                </div>

                {/* Integrations Section */}
                <div className="flex-1 p-6 space-y-6">
                    <div>
                        <h2 className="text-sm font-medium text-gray-900 mb-4">Integrations</h2>
                        <div className="space-y-4">
                            <LinearApiKeyForm />
                            <AddGithub />
                            <AddToSlack />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                <ChatInterface />
            </div>
        </div>
    )
}

function LinearApiKeyForm() {
    const [linearApiKey, setLinearApiKey] = useState<string | null>(null);
    const [input, setInput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        BackendProvider.getLinearApiKey().then(({ apiKey }) => {
            setLinearApiKey(apiKey);
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

    if (linearApiKey) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">Linear API Key</h3>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600">Connected</span>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mb-3">Your Linear integration is active</p>
                <button 
                    onClick={() => setLinearApiKey(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                    Disconnect
                </button>
            </div>
        )
    }

    return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Linear API Key</h3>
            <p className="text-xs text-gray-500 mb-3">Connect your Linear workspace to manage tickets</p>
            
            {error && (
                <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                    {error}
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-3">
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
        </div>
    )
}

export default Home;