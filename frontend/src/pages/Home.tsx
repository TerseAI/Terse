import { useAuth } from "../services/auth";
import { ChatInterface } from "../components/chat/ChatInterface";
import { AddToSlack } from "../components/AddToSlack";
import { AddGithub } from "../components/AddGithub";
import { AddLinear } from "../components/AddLinear";
import { AddJira } from "../components/AddJira";
import { Integration, useIntegrations } from "../context/Integrations";

function Home() {
    const { user, logout } = useAuth();
    const { integrations } = useIntegrations();

    const needsTicketingIntegration = !integrations.includes(Integration.LINEAR) && !integrations.includes(Integration.JIRA);

    return (
        <div className="flex h-screen bg-[#fafafa] text-gray-900">
            {/* Left Sidebar */}
            <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
                {/* Header */}
                <div className="px-6 py-8 border-b border-gray-200 bg-white">
                    <div className="mb-4">
                        <h1 className="text-xl font-bold text-gray-900">Vectra AI</h1>
                        <p className="text-sm text-gray-600 mt-1">Welcome back, {user?.display_name}</p>
                    </div>
                    <button
                        onClick={logout}
                        className="w-full px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors duration-200"
                    >
                        Sign out
                    </button>
                </div>

                {/* Integrations Section */}

                <div className="flex-1 p-6 space-y-6">
                    <div>
                        <h2 className="text-sm font-medium text-gray-900 mb-4">Integrations</h2>
                        <div className="space-y-4">
                            <TicketIntegration />
                            {!needsTicketingIntegration && (
                                <>
                                    <AddGithub />
                                    <AddToSlack />
                                </>
                            )}
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

function TicketIntegration() {
    const { integrations } = useIntegrations();
    const hasLinear = integrations.includes(Integration.LINEAR);
    const hasJira = integrations.includes(Integration.JIRA);

    if (!hasLinear && !hasJira) {
        return (
            <>
                <AddLinear />
                <p>or</p>
                <AddJira />
            </>
        )
    }

    else if (hasLinear) {
        return (
            <AddLinear />
        )
    }
    else {
        return (
            <AddJira />
        )
    }
}

export default Home;