import { useIntegrations } from "../context/Integrations";
import { MainContent } from "./MainContent";
import { Sidebar } from "./Sidebar";
import { SetupScreen } from "./SetupScreen";

interface DashboardProps {
    onIntegrationChange: () => Promise<void>;
    className?: string;
}

export function Dashboard({ onIntegrationChange, className = "" }: DashboardProps) {
    const { isSetupComplete } = useIntegrations();

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