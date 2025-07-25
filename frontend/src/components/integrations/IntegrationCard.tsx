import { ReactNode } from 'react';

interface IntegrationCardProps {
    title: string;
    description: string;
    isConnected: boolean;
    isLoading?: boolean;
    connectionInfo?: string;
    onConnect?: () => void;
    onDisconnect?: () => void;
    disconnectLabel?: string;
    connectButton?: ReactNode;
    icon?: ReactNode;
}

export function IntegrationCard({
    title,
    description,
    isConnected,
    isLoading = false,
    connectionInfo,
    onDisconnect,
    disconnectLabel = 'Disconnect',
    connectButton,
    icon
}: IntegrationCardProps) {
    if (isLoading) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">{title}</h3>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                </div>
                <p className="text-xs text-gray-500 mb-3">{description}</p>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
        );
    }

    if (isConnected) {
        return (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        {icon}
                        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-xs text-green-600">Connected</span>
                    </div>
                </div>
                {connectionInfo && (
                    <p className="text-xs text-gray-500 mb-3">{connectionInfo}</p>
                )}
                <p className="text-xs text-gray-500">Your {title.toLowerCase()} integration is active</p>
                {onDisconnect && (
                    <button 
                        onClick={onDisconnect}
                        className="mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        {disconnectLabel}
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <h3 className="text-sm font-medium text-gray-900">{title}</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">{description}</p>
            {connectButton}
        </div>
    );
} 