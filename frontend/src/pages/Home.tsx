import { useAuth } from "../services/auth";
import { ChatInterface } from "../components/chat/ChatInterface";
import { BackendProvider } from "../services/backend";

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

export default Home;