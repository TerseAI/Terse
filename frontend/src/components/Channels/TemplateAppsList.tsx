import { ChevronRight } from 'lucide-react';
import { IconForIntegration } from '../../pages/Channels/components/Integration';
import { IntegrationType } from "@/shared/Integrations";
import { capitalize } from '../../lib/utils';
import { ChannelTemplate } from '@/shared/types';

interface TemplateAppsListProps {
    template: ChannelTemplate;
}

export function TemplateAppsList({ template }: TemplateAppsListProps) {
    // Count input integrations using a hashmap
    const inputIntegrationCounts = new Map<IntegrationType, number>();
    template.inputs.forEach(input => {
        const integrationType = input.config.integrationType;
        const count = inputIntegrationCounts.get(integrationType) || 0;
        inputIntegrationCounts.set(integrationType, count + 1);
    });

    // Count knowledge base integrations using a hashmap
    const knowledgeBaseIntegrationCounts = new Map<IntegrationType, number>();
    template.knowledgeBases?.forEach(kb => {
        const integrationType = kb.config.integrationType;
        const count = knowledgeBaseIntegrationCounts.get(integrationType) || 0;
        knowledgeBaseIntegrationCounts.set(integrationType, count + 1);
    });

    const outputIntegrations = template.outputs?.map(o => o.config.integrationType) || [];
    const outputIntegrationCounts = new Map<IntegrationType, number>();
    outputIntegrations.forEach(integration => {
        const count = outputIntegrationCounts.get(integration) || 0;
        outputIntegrationCounts.set(integration, count + 1);
    });
    const hasInputs = inputIntegrationCounts.size > 0;
    const hasKnowledgeBases = knowledgeBaseIntegrationCounts.size > 0;
    const hasOutput = outputIntegrationCounts.size > 0;

    return (
        <div className="flex items-center gap-1.5">
            {/* Inputs */}
            {Array.from(inputIntegrationCounts.entries()).map(([integration, count], idx) => (
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

            {/* Arrow between inputs and knowledge bases/outputs */}
            {hasInputs && (hasKnowledgeBases || hasOutput) && (
                <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />
            )}

            {/* Knowledge Bases */}
            {Array.from(knowledgeBaseIntegrationCounts.entries()).map(([integration, count], idx) => (
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

            {/* Arrow between knowledge bases and outputs */}
            {hasKnowledgeBases && hasOutput && (
                <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />
            )}

            {/* Outputs */}
            {Array.from(outputIntegrationCounts.entries()).map(([integration, count], idx) => (
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
        </div>
    );
}
