import { AddLinear } from "./AddLinear";

interface TicketIntegrationProps {
    onIntegrationChange: () => Promise<void>;
}

export function TicketIntegration({ onIntegrationChange }: TicketIntegrationProps) {
    return <AddLinear onIntegrationChange={onIntegrationChange} />
} 