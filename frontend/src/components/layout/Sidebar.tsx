import { SystemStatus } from "../ui/SystemStatus";
import { Integrations } from "../integrations/Integrations";

interface SidebarProps {
    onIntegrationChange: () => Promise<void>;
    className?: string;
}

export function Sidebar({ onIntegrationChange, className = "" }: SidebarProps) {
    return (
        <div className={`lg:col-span-1 space-y-6 ${className}`}>
            <SystemStatus />
            <Integrations onIntegrationChange={onIntegrationChange} />
        </div>
    );
} 