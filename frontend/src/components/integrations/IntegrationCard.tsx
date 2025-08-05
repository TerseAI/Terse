import { ReactNode } from "react";
import Card from "../Card";

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
            <div className="bg-[theme(background-elevated)] rounded-lg p-4 max-w-sm">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-[theme(text-primary)]">{title}</h3>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                </div>
                <p className="text-xs text-[theme(text-secondary)] mb-3">{description}</p>
                <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
            </div>
        );
    }

    if (isConnected) {
        return (
            <Card className="max-w-sm">
                <div className="grid grid-flow-row mb-2">
                    <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                            {icon}
                            <h3 className="text-lg font-medium text-[theme(text-primary)]">{title}</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-[theme(accent)] rounded-full"></div>
                            <span className="text-xs text-[theme(accent)]">Connected</span>
                        </div>
                    </div>
                </div>
                {onDisconnect && (
                    <button
                        onClick={onDisconnect}
                        className="mt-2 text-sm text-[theme(text-secondary)] hover:text-[theme(text-primary)] transition-colors bg-[theme(background-elevated)] rounded-md p-2"
                    >
                        {disconnectLabel}
                    </button>
                )}
            </Card>
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