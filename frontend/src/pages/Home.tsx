import { useAuth } from "../services/auth";
import { AddToSlack } from "../components/AddToSlack";
import { AddGithub } from "../components/AddGithub";
import { AddLinear } from "../components/AddLinear";
import { AddJira } from "../components/AddJira";
import { Integration, useIntegrations } from "../context/Integrations";

function Home() {
    const { user, logout } = useAuth();
    const { integrations, refreshIntegrations } = useIntegrations();

    const hasGithub = integrations.includes(Integration.GITHUB);
    const hasLinear = integrations.includes(Integration.LINEAR);
    const hasJira = integrations.includes(Integration.JIRA);
    const hasSlack = integrations.includes(Integration.SLACK);

    const isSetupComplete = hasGithub && (hasLinear || hasJira);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <div className="flex items-center space-x-3">
                            <div>
                                <h1 className="text-xl font-semibold text-gray-900">Vectra AI</h1>
                                <p className="text-sm text-gray-600">Dashboard</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600">{user?.display_name}</span>
                            <button
                                onClick={logout}
                                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* System Status */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">System Status</span>
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${isSetupComplete ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <span className={`text-sm font-medium ${isSetupComplete ? 'text-green-600' : 'text-red-600'}`}>
                                                {isSetupComplete ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <span className="text-xs text-gray-500">
                                            {isSetupComplete 
                                                ? 'Listening for pushes to repository...' 
                                                : 'Complete setup to enable automation'
                                            }
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Slack Summaries</span>
                                    <div className="flex items-center space-x-2">
                                        {hasSlack ? (
                                            <>
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="text-sm font-medium text-green-600">Enabled</span>
                                            </>
                                        ) : (
                                            <>
                                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                                <span className="text-sm font-medium text-yellow-600">Disabled</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Integrations */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-6">Integrations</h2>
                            
                            <div className="space-y-6">
                                {/* GitHub */}
                                <div className="border-b border-gray-100 pb-6">
                                    <AddGithub onIntegrationChange={refreshIntegrations} />
                                </div>

                                {/* Ticketing System */}
                                <div className="border-b border-gray-100 pb-6">
                                    <TicketIntegration onIntegrationChange={refreshIntegrations} />
                                </div>

                                {/* Slack */}
                                <div>
                                    <AddToSlack onIntegrationChange={refreshIntegrations} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function TicketIntegration({ onIntegrationChange }: { onIntegrationChange: () => Promise<void> }) {
    const { integrations } = useIntegrations();
    const hasLinear = integrations.includes(Integration.LINEAR);
    const hasJira = integrations.includes(Integration.JIRA);

    if (!hasLinear && !hasJira) {
        return (
            <div className="space-y-3">
                <AddLinear onIntegrationChange={onIntegrationChange} />
                <div className="text-center">
                    <span className="text-sm text-gray-500">or</span>
                </div>
                <AddJira onIntegrationChange={onIntegrationChange} />
            </div>
        )
    }

    else if (hasLinear) {
        return <AddLinear onIntegrationChange={onIntegrationChange} />
    }
    else {
        return <AddJira onIntegrationChange={onIntegrationChange} />
    }
}

export default Home;