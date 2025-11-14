import { ChevronRight } from 'lucide-react';
import { Automation } from '../../shared/types';
import { IconForInputType } from '../../pages/Automations/components/Integration';
import { Integration } from '../../context/Integrations';
import { capitalize } from '../../lib/utils';

interface AppsListProps {
    automation: Automation;
}

export function AppsList({ automation }: AppsListProps) {
    const deduplicatedInputIntegrations = [...new Set(automation.inputs.map(input => input.integration))];

    const outputIntegration = automation.output?.integration;

    return (
        <div className="flex items-center gap-1.5">
            {deduplicatedInputIntegrations.map((integration, idx) => (
                <div key={idx} className="flex items-center">
                    <div
                        className="w-7 h-7 flex items-center justify-center rounded bg-card p-1"
                        title={capitalize(integration)}
                    >
                        <IconForInputType type={integration as Integration} />
                    </div>
                </div>
            ))}
            {outputIntegration && (
                <div className="flex items-center">
                    <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />
                    <div className="w-7 h-7 flex items-center justify-center rounded bg-card p-1" title={capitalize(outputIntegration)}>
                        <IconForInputType type={outputIntegration as Integration} />
                    </div>
                </div>
            )}
        </div>
    );
}
