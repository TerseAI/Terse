import { ChevronRight } from 'lucide-react';
import { Channel } from '../../shared/types';
import { IconForIntegration } from '../../pages/Channels/components/Integration';
import { IntegrationType } from "@/shared/Integrations"
import { capitalize } from '../../lib/utils';

interface AppsListProps {
    channel: Channel;
}

export function AppsList({ channel }: AppsListProps) {
    // Count integrations using a hashmap
    const integrationCounts = new Map<IntegrationType, number>();
    channel.inputs.forEach(input => {
        const count = integrationCounts.get(input.config.integrationType) || 0;
        integrationCounts.set(input.config.integrationType, count + 1);
    });

    const outputIntegration = channel.output?.config?.integrationType;

    return (
        <div className="flex items-center gap-1.5">
            {Array.from(integrationCounts.entries()).map(([integration, count], idx) => (
                <div key={idx} className="flex items-center">
                    <div
                        className="relative w-7 h-7 flex items-center justify-center rounded bg-card p-1"
                        title={capitalize(integration)}
                    >
                        <IconForIntegration integration={integration} />
                        {count > 1 && (
                            <sup className="absolute -top-1.5 -right-1.5 text-[9px] font-mono tabular-nums leading-none z-10 text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center shadow-md backdrop-blur-sm">
                                {count}
                            </sup>
                        )}
                    </div>
                </div>
            ))}
            {outputIntegration && (
                <div className="flex items-center">
                    <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />
                    <div className="w-7 h-7 flex items-center justify-center rounded bg-card p-1" title={capitalize(outputIntegration)}>
                        <IconForIntegration integration={outputIntegration} />
                    </div>
                </div>
            )}
        </div>
    );
}
