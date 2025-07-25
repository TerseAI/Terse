import { useIntegrations } from "../context/Integrations";
import { MainContent } from "../layout/MainContent";
import { Sidebar } from "../layout/Sidebar";
import { SetupScreen } from "../setup/SetupScreen";
import { LoadingDashboard } from "./LoadingDashboard";

interface DashboardProps {
    onIntegrationChange: () => Promise<void>;
    className?: string;
}

export function Dashboard({ onIntegrationChange, className = "" }: DashboardProps) {
    const { isSetupComplete, isLoading } = useIntegrations();

    if (isLoading) {
        return <LoadingDashboard />;
    }

    if (!isSetupComplete) {
        return <SetupScreen onIntegrationChange={onIntegrationChange} className={className} />;
    }

    return (
        <div className={`grid grid-cols-1 lg:grid-cols-4 gap-8 ${className}`}>
            <MainContent />
            <Sidebar onIntegrationChange={onIntegrationChange} />
        </div>
    );
} 