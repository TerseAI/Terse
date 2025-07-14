import { AddLinear } from "./AddLinear";
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
            </div>
        )
    }

    else {
        return <AddLinear onIntegrationChange={onIntegrationChange} />
    }
} 