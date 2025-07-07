import { useAuth } from "../services/auth";
import { ChatInterface } from "../components/chat/ChatInterface";
import { AddToSlack } from "../components/AddToSlack";
import { AddGithub } from "../components/AddGithub";
import { AddLinear } from "../components/AddLinear";

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
                            <AddLinear />
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

export default Home;