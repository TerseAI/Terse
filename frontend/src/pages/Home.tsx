import { useAuth } from "../services/auth";
import { AddToSlack } from "../components/AddToSlack";
import { AddGithub } from "../components/AddGithub";
import { AddLinear } from "../components/AddLinear";
import { AddJira } from "../components/AddJira";
// import { ActivityFeed } from "../components/ActivityFeed";
import { Integration, useIntegrations } from "../context/Integrations";
import { ChatInterface } from "../components/chat/ChatInterface";

function Home() {
    const { user, logout } = useAuth();
    const { integrations, isLoading, refreshIntegrations } = useIntegrations();

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
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isLoading ? (
                    <LoadingState />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Activity Feed - Main Content */}
                        <div className="lg:col-span-3">
                            {/* <ActivityFeed /> */}
                            <ChatInterface />
                        </div>

                        {/* Sidebar */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* System Status */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
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

                            {/* Integrations */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Integrations</h2>
                                
                                <div className="space-y-4">
                                    {/* GitHub */}
                                    <div className="border-b border-gray-100 pb-4">
                                        <AddGithub onIntegrationChange={refreshIntegrations} />
                                    </div>

                                    {/* Ticketing System */}
                                    <div className="border-b border-gray-100 pb-4">
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
                )}
            </div>
        </div>
    )
}

function LoadingState() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Activity Feed Skeleton */}
            <div className="lg:col-span-3">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
                        <div className="w-6 h-6 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
                                <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                                    <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sidebar Skeleton */}
            <div className="lg:col-span-1 space-y-6">
                {/* System Status Skeleton */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse"></div>
                                    <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                                </div>
                            </div>
                            <div className="mt-2">
                                <div className="h-3 bg-gray-200 rounded w-48 animate-pulse"></div>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                            <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse"></div>
                                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Integrations Skeleton */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse"></div>
                    
                    <div className="space-y-4">
                        {/* GitHub Skeleton */}
                        <div className="border-b border-gray-100 pb-4">
                            <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-48 animate-pulse"></div>
                                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </div>
                        </div>

                        {/* Ticketing System Skeleton */}
                        <div className="border-b border-gray-100 pb-4">
                            <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-56 animate-pulse"></div>
                                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </div>
                        </div>

                        {/* Slack Skeleton */}
                        <div>
                            <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                                <div className="h-3 bg-gray-200 rounded w-40 animate-pulse"></div>
                                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Privacy Notice Skeleton */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        <div className="h-3 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                    </div>
                </div>
            </div>
        </div>
    );
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