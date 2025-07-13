import { AddLinear } from "./AddLinear";
import { AddJira } from "./AddJira";
import { useIntegrations } from "../context/Integrations";

interface TicketIntegrationProps {
    onIntegrationChange: () => Promise<void>;
}

export function TicketIntegration({ onIntegrationChange }: TicketIntegrationProps) {
    const { hasLinear, hasJira } = useIntegrations();

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