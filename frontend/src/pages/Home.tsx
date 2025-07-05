import { useAuth } from "../services/auth";
import { ChatInterface } from "../components/chat/ChatInterface";
import { BackendProvider } from "../services/backend";
import { useEffect, useState } from "react";

function Home() {
    const { user, logout } = useAuth();

    return (
        <div className="grid grid-cols-10 h-screen bg-[rgb(8,9,10)]">
            <div className="col-span-2 p-4 text-white">
                <h1>Home, {user?.display_name}</h1>
                <button
                    onClick={() => {
                        BackendProvider.requestGitHubAppInstallationUrl().then(({ installationUrl }) => {
                            console.log('installationUrl', installationUrl);
                            window.open(installationUrl, '_blank', 'width=600,height=700,scrollbars=yes,resizable=yes');
                        });
                    }}
                >
                    Install GitHub App
                </button>
                <LinearApiKeyForm />
            </div>
            <div className="col-span-6">
                <ChatInterface />
            </div>
            <div className="col-span-2 p-4 text-white">
                <h1>Home, {user?.display_name}</h1>
                <button
                    onClick={logout}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                    Logout
                </button>
            </div>
        </div>
    )
}

function LinearApiKeyForm() {
    const [linearApiKey, setLinearApiKey] = useState<string | null>(null);
    const [input, setInput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        BackendProvider.getLinearApiKey().then(({ apiKey }) => {
            setLinearApiKey(apiKey);
        });
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        setError(null);
        e.preventDefault();
        try {
            await BackendProvider.setLinearApiKey(input);
            setLinearApiKey(input);
            setError(null);
        } catch (error) {
            console.error('Error setting Linear API key:', error);
            setError('Invalid API Key');
        }
    }

    if (!linearApiKey) {
        return (
            <>
                {error ? (
                    <p className="text-red-500">{error}</p>
                ) : (
                    <p className="text-green-500">Valid API Key</p>
                )}
                <form onSubmit={handleSubmit}>
                    <input type="text" placeholder="Linear API Key" className="w-full p-2 rounded-md bg-gray-800 text-white" onChange={(e) => setInput(e.target.value)} />
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                        Submit
                    </button>
                </form>
            </>
        )
    }

    return (
        <>
            {error ? (
                <p className="text-red-500">{error}</p>
            ) : (
                <p className="text-green-500">Valid API Key</p>
            )}

            <div>
                <p>Linear API Key: {linearApiKey}</p>
                <button onClick={() => setLinearApiKey(null)}>Clear</button>
            </div>
        </>
    )
}

export default Home;