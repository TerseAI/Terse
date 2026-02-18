import { ChevronRight } from "lucide-react"

import { IntegrationType } from "@/shared/Integrations"
import { AgentTemplate } from "@/shared/types"

import { capitalize } from "../../lib/utils"
import { IconForIntegration } from "../../pages/Agents/components/Integration"

interface TemplateAppsListProps {
    template: AgentTemplate
}

export function TemplateAppsList({ template }: TemplateAppsListProps) {
    // Count input integrations using a hashmap
    const inputIntegrationCounts = new Map<IntegrationType, number>()
    template.triggers.forEach(input => {
        const integrationType = input.config.integrationType
        const count = inputIntegrationCounts.get(integrationType) || 0
        inputIntegrationCounts.set(integrationType, count + 1)
    })

    // Count output integrations using a hashmap
    const outputIntegrationCounts = new Map<IntegrationType, number>()
    if (template.outputs && template.outputs.length > 0) {
        template.outputs.forEach(output => {
            const integrationType = output.config.integrationType
            const count = outputIntegrationCounts.get(integrationType) || 0
            outputIntegrationCounts.set(integrationType, count + 1)
        })
    }

    const hasInputs = inputIntegrationCounts.size > 0
    const hasOutput = outputIntegrationCounts.size > 0

    return (
        <div className="flex items-center gap-1.5">
            {/* Inputs */}
            {Array.from(inputIntegrationCounts.entries()).map(([integration, count], idx) => (
                <div key={idx} className="flex items-center">
                    <div className="relative w-7 h-7 flex items-center justify-center rounded bg-card p-1" title={capitalize(integration)}>
                        <IconForIntegration integration={integration} />
                        {count > 1 && (
                            <sup className="absolute -top-1.5 -right-1.5 text-[9px] font-mono tabular-nums leading-none z-10 text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center shadow-md backdrop-blur-sm">
                                {count}
                            </sup>
                        )}
                    </div>
                </div>
            ))}

            {/* Arrow between triggers and skills */}
            {hasInputs && hasOutput && <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />}

            {/* Arrow between read-only and write skills */}
            {hasOutput && <ChevronRight className="w-3 h-3 text-muted-foreground mx-0.5" />}

            {/* Outputs */}
            {Array.from(outputIntegrationCounts.entries()).map(([integration, count], idx) => (
                <div key={idx} className="flex items-center">
                    <div className="relative w-7 h-7 flex items-center justify-center rounded bg-card p-1" title={capitalize(integration)}>
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
    )
}
