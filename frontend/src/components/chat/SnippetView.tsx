import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { AlertCircle, ExternalLink, ImageOff, SquareArrowOutUpRight } from "lucide-react"
import { IntegrationType } from "terse-types"
import { type ChatSnippet } from "terse-types"

import { formatServerCheckStep } from "@/lib/sdkJobServerCheck"

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

    if (snippet.type === "image") {
        return <ImageSnippet url={snippet.url} />
    }

    if (snippet.type === "webhook_failure") {
        return <WebhookFailureSnippet snippet={snippet} />
    }

    return null
}

function WebhookFailureSnippet({ snippet }: { snippet: Extract<ChatSnippet, { type: "webhook_failure" }> }) {
    const title = snippet.stage === "handshake" ? "Server Challenge Failed" : "Webhook Delivery Failed"
    const stepLabel = snippet.step ? formatServerCheckStep(snippet.step) : null

    return (
        <div className="rounded-lg border border-danger/30 bg-danger/5 select-text">
            <div className="flex items-start gap-2 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-foreground">{title}</span>
                        {snippet.httpStatus !== undefined && <span className="font-mono text-xs text-danger/80">HTTP {snippet.httpStatus}</span>}
                    </div>
                    <p className="text-sm text-muted-foreground break-words">{snippet.message}</p>
                </div>
            </div>

            <div className="space-y-1.5 border-t border-danger/15 px-3 py-2.5 text-xs">
                {stepLabel && (
                    <DetailRow label="Stage">
                        <span className="text-foreground">{stepLabel}</span>
                    </DetailRow>
                )}
                <DetailRow label="URL">
                    <span className="font-mono break-all text-foreground">{snippet.triggerUrl}</span>
                </DetailRow>
                {snippet.bodySnippet && (
                    <DetailRow label="Response">
                        <pre className="m-0 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-2 font-mono text-xs text-foreground">{snippet.bodySnippet}</pre>
                    </DetailRow>
                )}
            </div>
        </div>
    )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
            <span className="text-muted-foreground">{label}</span>
            <div className="min-w-0">{children}</div>
        </div>
    )
}

function ImageSnippet({ url }: { url: string }) {
    const [errored, setErrored] = useState(false)

    if (errored) {
        return (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-1 py-1 text-sm text-muted-foreground">
                <ImageOff className="h-4 w-4 flex-shrink-0" />
                <span>Image unavailable</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="ml-auto text-xs underline hover:text-foreground">
                    Open URL
                </a>
            </div>
        )
    }

    return <img src={url} alt="Generated image" className="max-w-sm rounded-md border border-border" onError={() => setErrored(true)} />
}
