import { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"

import { ExternalLink, SquareArrowOutUpRight } from "lucide-react"

import { IntegrationType } from "../../shared/Integrations"
import { ChatSnippet } from "../../shared/ModelEvents"
import IntegrationCard from "../Integrations/IntegrationCard"
import { Button } from "../ui/button"

import { MultipleChoiceQuestionForm } from "./MultipleChoiceQuestionForm"

export function SnippetView({ snippet, onMultipleChoiceAnswer }: { snippet: ChatSnippet; onMultipleChoiceAnswer?: (questionId: string, value: string) => void }) {
    const navigate = useNavigate()

    useEffect(() => {
        if (snippet.type === "navigate") {
            navigate(snippet.path)
        }
    }, [snippet, navigate])

    if (snippet.type === "navigate") {
        // Return null since we're navigating away
        return null
    }

    if (snippet.type === "button") {
        const isInternalPath = snippet.url.startsWith("/")
        return (
            <div>
                {isInternalPath ? (
                    <Button asChild variant="outline" size="sm" className="justify-start gap-2 bg-transparent shadow-none hover:bg-transparent">
                        <Link to={snippet.url}>
                            <SquareArrowOutUpRight className="w-4 h-4" />
                            <span>{snippet.label}</span>
                        </Link>
                    </Button>
                ) : (
                    <Button asChild variant="outline" size="sm" className="justify-start gap-2 bg-transparent shadow-none hover:bg-transparent">
                        <a href={snippet.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                            <span>{snippet.label}</span>
                        </a>
                    </Button>
                )}
            </div>
        )
    }

    if (snippet.type === "integration_prompt") {
        // Convert string to IntegrationType if it's a valid enum value
        const integrationType = Object.values(IntegrationType).includes(snippet.integration as IntegrationType) ? (snippet.integration as IntegrationType) : null

        if (!integrationType) {
            // Fallback if integration type is not recognized
            const integrationName = snippet.integration.charAt(0).toUpperCase() + snippet.integration.slice(1)
            return (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <div className="text-sm font-semibold text-blue-500 mb-1">Connect {integrationName}</div>
                    <div className="text-sm text-gray-300">{snippet.message}</div>
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

    if (snippet.type === "multiple_choice") {
        return (
            <MultipleChoiceQuestionForm
                questionId={snippet.questionId}
                question={snippet.question}
                options={snippet.options}
                allowMultiple={snippet.allowMultiple}
                selectedValue={snippet.selectedValue}
                onSubmit={value => onMultipleChoiceAnswer?.(snippet.questionId, value)}
            />
        )
    }

    return null
}
