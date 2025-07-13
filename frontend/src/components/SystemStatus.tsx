import { useIntegrations } from "../context/Integrations";

interface SystemStatusProps {
    className?: string;
}

export function SystemStatus({ className = "" }: SystemStatusProps) {
    const { hasSlack, isSetupComplete } = useIntegrations();

    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
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
    );
} 