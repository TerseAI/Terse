import { useState } from "react"

import { CheckIcon, DocumentDuplicateIcon, HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/24/outline"
import { HandThumbDownIcon as HandThumbDownFilledIcon, HandThumbUpIcon as HandThumbUpFilledIcon } from "@heroicons/react/24/solid"

import { Button } from "@/components/ui/button"
import type { ToolApprovalResponseOptions } from "@/lib/socket"

import type { Turn } from "../turnModel"

import { RunErrorView } from "./RunErrorView"
import { ProcessOutputUnit } from "./units/ProcessOutputUnit"
import { SnippetUnit } from "./units/SnippetUnit"
import { TextUnit } from "./units/TextUnit"
import { ThinkingUnit } from "./units/ThinkingUnit"
import { ToolCallUnit } from "./units/ToolCallUnit"

interface TurnViewProps {
    turn: Turn
    disableAnimation?: boolean
    onApprove?: (stepId: string, options?: ToolApprovalResponseOptions) => void
    onReject?: (stepId: string, options?: ToolApprovalResponseOptions) => void
    onSendMessage?: (message: string) => void
    onMultipleChoiceAnswer?: (questionId: string, value: string) => void
}

export function TurnView({ turn, disableAnimation = false, onApprove, onReject, onSendMessage, onMultipleChoiceAnswer }: TurnViewProps) {
    const isUser = turn.role === "user"
    const textForActions = turn.units
        .filter(unit => unit.kind === "text")
        .map(unit => unit.text)
        .join("")
    const showAssistantActions = turn.role === "assistant" && turn.status !== "generating" && textForActions.length > 0

    if (turn.status === "cancelled") return null

    if (isUser) {
        return (
            <div className="flex justify-end animate-in fade-in-0">
                <div className="min-w-0 max-w-[min(86%,38rem)] rounded-2xl rounded-br-sm bg-secondary px-4 py-3 text-[0.9375rem] leading-6 text-secondary-foreground shadow-[var(--shadow-control)] [overflow-wrap:anywhere] sm:max-w-[78%]">
                    <span className="select-text">{turn.userMessage}</span>
                </div>
            </div>
        )
    }

    if (turn.status === "failed") {
        return (
            <div className="flex justify-start">
                <div className="min-w-0 w-full max-w-[42rem]">
                    <RunErrorView error={turn.error?.message ?? "Run failed"} errorCode={turn.error?.code} />
                </div>
            </div>
        )
    }

    return (
        <div data-chat-turn className="group/turn flex justify-start">
            <div className="min-w-0 w-full max-w-[42rem] space-y-3">
                {turn.units.map((unit, index) => {
                    switch (unit.kind) {
                        case "text":
                            return <TextUnit key={unit.unitId} unit={unit} disableAnimation={disableAnimation || turn.disableAnimation} />
                        case "tool_call":
                            return (
                                <ToolCallUnit
                                    key={unit.unitId}
                                    unit={unit}
                                    index={index}
                                    isTurnFailure={turn.status === "failed"}
                                    onApprove={onApprove}
                                    onReject={onReject}
                                    onSendMessage={onSendMessage}
                                />
                            )
                        case "snippet":
                            return <SnippetUnit key={unit.unitId} unit={unit} onMultipleChoiceAnswer={onMultipleChoiceAnswer} />
                        case "process_output":
                            return <ProcessOutputUnit key={unit.unitId} unit={unit} />
                        case "thinking":
                            return turn.status === "generating" ? <ThinkingUnit key={unit.unitId} unit={unit} /> : null
                        default: {
                            const exhaustive: never = unit
                            return exhaustive
                        }
                    }
                })}

                {showAssistantActions && (
                    <div className="chat-turn-actions flex gap-1 opacity-100 transition-opacity">
                        <CopyButton text={textForActions} />
                        <FeedbackButtons />
                    </div>
                )}
            </div>
        </div>
    )
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            // Clipboard API may be unavailable; ignore copy failure
        }
    }

    return (
        <Button type="button" variant="ghost" size="icon-sm" onClick={handleCopy} className="text-muted-foreground" aria-label="Copy response">
            {copied ? <CheckIcon className="w-4 h-4 text-success animate-pop ring-1 ring-success/20 ring-opacity-50 rounded" /> : <DocumentDuplicateIcon className="w-4 h-4" />}
        </Button>
    )
}

enum FeedbackState {
    None,
    Good,
    Bad
}

function FeedbackButtons() {
    const [feedback, setFeedback] = useState<FeedbackState>(FeedbackState.None)

    if (feedback === FeedbackState.None) {
        return (
            <>
                <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setFeedback(FeedbackState.Good)} aria-label="Mark response as helpful">
                    <HandThumbUpIcon className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setFeedback(FeedbackState.Bad)} aria-label="Mark response as not helpful">
                    <HandThumbDownIcon className="h-4 w-4" />
                </Button>
            </>
        )
    }

    if (feedback === FeedbackState.Good) {
        return (
            <div className="flex gap-2" role="status" aria-label="Response marked as helpful">
                <span className="grid size-8 animate-pop place-items-center rounded-md text-success">
                    <HandThumbUpFilledIcon className="h-4 w-4" />
                </span>
            </div>
        )
    }

    return (
        <div className="flex gap-2" role="status" aria-label="Response marked as not helpful">
            <span className="grid size-8 animate-pop place-items-center rounded-md text-danger">
                <HandThumbDownFilledIcon className="h-4 w-4" />
            </span>
        </div>
    )
}
