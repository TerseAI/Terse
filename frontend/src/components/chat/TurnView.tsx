import { useState } from "react"

import { CheckIcon, DocumentDuplicateIcon, HandThumbDownIcon, HandThumbUpIcon } from "@heroicons/react/24/outline"
import { HandThumbDownIcon as HandThumbDownFilledIcon, HandThumbUpIcon as HandThumbUpFilledIcon } from "@heroicons/react/24/solid"

import type { ToolApprovalResponseOptions } from "../../socket"

import { RunErrorView } from "./RunErrorView"
import type { Turn } from "./turnModel"
import { ProcessOutputUnit } from "./units/ProcessOutputUnit"
import { SnippetUnit } from "./units/SnippetUnit"
import { TextUnit } from "./units/TextUnit"
import { ThinkingUnit } from "./units/ThinkingUnit"
import { ToolCallUnit } from "./units/ToolCallUnit"

interface TurnViewProps {
    turn: Turn
    isLatestAssistantTurn?: boolean
    disableAnimation?: boolean
    onAssistantTextDisplayComplete?: () => void
    onApprove?: (stepId: string, options?: ToolApprovalResponseOptions) => void
    onReject?: (stepId: string, options?: ToolApprovalResponseOptions) => void
    onSendMessage?: (message: string) => void
    onMultipleChoiceAnswer?: (questionId: string, value: string) => void
}

export function TurnView({ turn, isLatestAssistantTurn = false, disableAnimation = false, onAssistantTextDisplayComplete, onApprove, onReject, onSendMessage, onMultipleChoiceAnswer }: TurnViewProps) {
    const isUser = turn.role === "user"
    const textUnits = turn.units.filter(unit => unit.kind === "text")
    const textForActions = textUnits.map(unit => unit.text).join("")
    const lastTextUnit = textUnits[textUnits.length - 1]
    const showAssistantActions = turn.role === "assistant" && turn.status !== "generating" && textForActions.length > 0

    if (turn.status === "cancelled") return null

    if (isUser) {
        return (
            <div className="flex rounded-lg justify-end animate-in fade-in-0">
                <div className="max-w-[90%] space-y-2.5">
                    <div className="text-foreground text-md py-2 rounded-8xl select-text">
                        <div className="prose prose-invert bg-muted rounded-lg p-3">
                            <span className="select-text">{turn.userMessage}</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (turn.status === "failed") {
        return (
            <div className="flex rounded-lg justify-start">
                <div className="max-w-[90%] space-y-2.5">
                    <div className="text-foreground text-md py-2 rounded-8xl select-text">
                        <div className="prose prose-invert">
                            <RunErrorView error={turn.error?.message ?? "Run failed"} errorCode={turn.error?.code} />
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex rounded-lg justify-start">
            <div className="max-w-[90%] space-y-2.5">
                {turn.units.map((unit, index) => {
                    switch (unit.kind) {
                        case "text":
                            return (
                                <TextUnit
                                    key={unit.unitId}
                                    unit={unit}
                                    disableAnimation={disableAnimation || turn.disableAnimation}
                                    onComplete={isLatestAssistantTurn && unit.unitId === lastTextUnit?.unitId ? onAssistantTextDisplayComplete : undefined}
                                />
                            )
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
                            return <ThinkingUnit key={unit.unitId} unit={unit} />
                        default: {
                            const exhaustive: never = unit
                            return exhaustive
                        }
                    }
                })}

                {showAssistantActions && (
                    <div className="flex gap-2">
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
        <button onClick={handleCopy} className="rounded text-muted-foreground transition-colors duration-200 hover:cursor-pointer hover:opacity-80 active:scale-95" aria-label="Copy to clipboard">
            {copied ? <CheckIcon className="w-4 h-4 text-success animate-pop ring-1 ring-success/20 ring-opacity-50 rounded" /> : <DocumentDuplicateIcon className="w-4 h-4" />}
        </button>
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
                <button className="rounded text-muted-foreground transition-colors duration-200 hover:cursor-pointer hover:opacity-80 active:scale-95" onClick={() => setFeedback(FeedbackState.Good)}>
                    <HandThumbUpIcon className="h-4 w-4" />
                </button>
                <button className="rounded text-muted-foreground transition-colors duration-200 hover:cursor-pointer hover:opacity-80 active:scale-95" onClick={() => setFeedback(FeedbackState.Bad)}>
                    <HandThumbDownIcon className="h-4 w-4" />
                </button>
            </>
        )
    }

    if (feedback === FeedbackState.Good) {
        return (
            <div className="flex gap-2">
                <button className="rounded text-muted-foreground transition-colors animate-pop">
                    <HandThumbUpFilledIcon className="h-4 w-4" />
                </button>
            </div>
        )
    }

    return (
        <div className="flex gap-2">
            <button className="rounded text-muted-foreground transition-colors animate-pop">
                <HandThumbDownFilledIcon className="h-4 w-4" />
            </button>
        </div>
    )
}
