import { Integrations } from "../integrations/Integrations";

interface SetupIntegrationsProps {
    onIntegrationChange: () => Promise<void>;
    className?: string;
}

export function SetupIntegrations({ onIntegrationChange, className = "" }: SetupIntegrationsProps) {
    return (
        <div className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-8 ${className}`}>
            <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Tools</h2>
                <p className="text-gray-600">Choose the integrations you'd like to set up first</p>
            </div>
            <Integrations onIntegrationChange={onIntegrationChange} />
        </div>
    );
} 