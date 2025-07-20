import { AddGithub } from "./AddGithub";

interface IntegrationsProps {
    onIntegrationChange: () => Promise<void>;
    className?: string;
}

export function Integrations({ className = "" }: IntegrationsProps) {
    return (
        <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Integrations</h2>
            
            <div className="space-y-4">
                {/* GitHub */}
                <AddGithub />
            </div>
        </div>
    );
} 