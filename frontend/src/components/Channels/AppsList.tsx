import { ChevronRight } from 'lucide-react';
import { Channel } from '../../shared/types';
import { IconForIntegration } from '../../pages/Channels/components/Integration';
import { IntegrationType } from "@/shared/Integrations"
import { capitalize } from '../../lib/utils';

interface AppsListProps {
    channel: Channel;
}

export function AppsList({ channel }: AppsListProps) {
    // Count input integrations using a hashmap
    const inputIntegrationCounts = new Map<IntegrationType, number>();
    channel.inputs.forEach(input => {
        const count = inputIntegrationCounts.get(input.config.integrationType) || 0;
        inputIntegrationCounts.set(input.config.integrationType, count + 1);
    });

    // Count knowledge base integrations using a hashmap
    const knowledgeBaseIntegrationCounts = new Map<IntegrationType, number>();
    channel.knowledgeBases?.forEach(kb => {
        const count = knowledgeBaseIntegrationCounts.get(kb.config.integrationType) || 0;
        knowledgeBaseIntegrationCounts.set(kb.config.integrationType, count + 1);
    });

    // Count output integrations using a hashmap
    const outputIntegrationCounts = new Map<IntegrationType, number>();
    if (channel.outputs && channel.outputs.length > 0) {
        channel.outputs.forEach(output => {
            const count = outputIntegrationCounts.get(output.config.integrationType) || 0;
            outputIntegrationCounts.set(output.config.integrationType, count + 1);
        });
    }
    
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
