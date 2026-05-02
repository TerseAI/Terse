import { IntegrationType } from "terse-types"
import type { ChatSnippet } from "terse-types"

import IntegrationCard from "../../Integrations/IntegrationCard"

export type IntegrationPromptSnippetData = Extract<ChatSnippet, { type: "integration_prompt" }>

export function IntegrationPromptSnippet({ snippet }: { snippet: IntegrationPromptSnippetData }) {
    const integrationType = Object.values(IntegrationType).includes(snippet.integration as IntegrationType) ? (snippet.integration as IntegrationType) : null

    if (!integrationType) {
        const integrationName = snippet.integration.charAt(0).toUpperCase() + snippet.integration.slice(1)
        return (
            <div className="bg-accent-primary/10 border border-accent-primary/20 rounded-lg p-3">
                <div className="text-sm font-semibold text-accent-primary mb-1">Connect {integrationName}</div>
                <div className="text-sm text-muted-foreground">{snippet.message}</div>
            </div>
        )
    }

    return (
        <div>
            <IntegrationCard integration={integrationType} isActive={false} stateToken={snippet.stateToken} compact />
            {snippet.message && <div className="mt-2 text-sm text-muted-foreground">{snippet.message}</div>}
        </div>
    )
}
