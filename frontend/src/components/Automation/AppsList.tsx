import { ChevronRight } from 'lucide-react';
import { Automation } from '../../shared/types';
import { IconForInputType } from '../../pages/Automations/components/Integration';
import { IntegrationType } from "@/shared/Integrations"
import { capitalize } from '../../lib/utils';

interface AppsListProps {
    automation: Automation;
}

export function AppsList({ automation }: AppsListProps) {
    // Count integrations using a hashmap
    const integrationCounts = new Map<string, number>();
    automation.inputs.forEach(input => {
        const count = integrationCounts.get(input.integration) || 0;
        integrationCounts.set(input.integration, count + 1);
    });

    const outputIntegration = automation.output?.integration;

    return (
        <div className="flex items-center gap-1.5">
            {Array.from(integrationCounts.entries()).map(([integration, count], idx) => (
                <div key={idx} className="flex items-center">
                    <div
                        className="relative w-7 h-7 flex items-center justify-center rounded bg-card p-1"
                        title={capitalize(integration)}
                    >
                        <IconForInputType type={integration as IntegrationType} />
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
                        <IconForInputType type={outputIntegration as IntegrationType} />
                    </div>
                </div>
            )}
        </div>
    );
}
