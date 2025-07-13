import { AddToSlack } from "./AddToSlack";
import { AddGithub } from "./AddGithub";
import { TicketIntegration } from "./TicketIntegration";

interface IntegrationsProps {
    onIntegrationChange: () => Promise<void>;
    className?: string;
}

export function Integrations({ onIntegrationChange, className = "" }: IntegrationsProps) {
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Integrations</h2>
            
            <div className="space-y-4">
                {/* GitHub */}
                <div className="border-b border-gray-100 pb-4">
                    <AddGithub onIntegrationChange={onIntegrationChange} />
                </div>

                {/* Ticketing System */}
                <div className="border-b border-gray-100 pb-4">
                    <TicketIntegration onIntegrationChange={onIntegrationChange} />
                </div>

                {/* Slack */}
                <div>
                    <AddToSlack onIntegrationChange={onIntegrationChange} />
                </div>
            </div>
        </div>
    );
} 