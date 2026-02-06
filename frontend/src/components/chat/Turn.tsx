import { useState } from "react"

import { CheckCircleIcon, CheckIcon, DocumentDuplicateIcon, HandThumbDownIcon, HandThumbUpIcon, XCircleIcon } from "@heroicons/react/24/outline"
import { HandThumbDownIcon as HandThumbDownFilledIcon, HandThumbUpIcon as HandThumbUpFilledIcon } from "@heroicons/react/24/solid"

import { ChangedItem, ChatSnippet, FailureCategory, SharedErrorContext } from "../../shared/ModelEvents"

import { SnippetView } from "./SnippetView"
import TokenStream from "./TokenStream"
import ToolCallsSummary from "./ToolCallsSummary"

interface FailureDetails {
    category?: FailureCategory
    userMessage?: string
    userGuidance?: string
    isRecoverable?: boolean
    source?: string
}

interface Turn {
    role: "user" | "assistant"
    text: string
    function_calls: FunctionCallEvent[]
    step_id: string
    isFailure?: boolean
    failureDetails?: FailureDetails
    isGenerating?: boolean
    isThinking?: boolean
    filter_result?: {
        isRelevant: boolean
        reason: string
        confidence: number
    }
    snippets?: ChatSnippet[]
    disableAnimation?: boolean
    onApprove?: (stepId: string) => void
    onReject?: (stepId: string) => void
}

interface FunctionCallEvent {
    id: string
    name: string
    isGeneratingParams?: boolean
    isRunning: boolean
    isWaitingForApproval?: boolean
    isRejected?: boolean
    isApproved?: boolean
    isWaitingForUserInput?: boolean
    isFailure?: boolean
    parameters?: string
    result?: string
    changed_items?: ChangedItem[]
    errorContext?: SharedErrorContext
}

function TurnView({ role, text, function_calls, isFailure = false, failureDetails, isGenerating = false, isThinking = false, filter_result, snippets = [], disableAnimation = false, onApprove, onReject }: Turn) {
    const isUser = role === "user"
    const isAssistantFinishedGenerating = !isGenerating && role === "assistant" && text.length > 0
    const isContextWindowError = isFailure && failureDetails?.category === "context_window_exceeded"

    // Expanded state - show all steps with status
    return (
        <div className={`flex rounded-lg ${isUser ? "justify-end animate-in fade-in-0" : "justify-start"}`}>
            <div className="space-y-2 max-w-[90%]">
                {filter_result && <FilterResultView filterResult={filter_result} />}

                {isThinking && (
                    <div className="text-[#F1F1F1] text-md py-2 rounded-8xl">
                        <div className="prose prose-invert">
                            <div className="flex items-center gap-2 text-gray-400 italic">
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                </svg>
                                <span>Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                {isContextWindowError && failureDetails && <ContextWindowErrorView details={failureDetails} />}

                {(text || (isFailure && !isContextWindowError)) && (
                    <div className="text-[#F1F1F1] text-md py-2 rounded-8xl select-text">
                        <div className={`prose prose-invert ${isUser ? "bg-stone-900/80 rounded-lg p-3" : ""}`}>
                            {isFailure && !isContextWindowError && (
                                <svg className="w-4 h-4 text-red-500 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                            {isUser ? (
                                <span className="select-text">{text}</span>
                            ) : (
                                <div className="select-text">
                                    <TokenStream text={text} disableAnimation={disableAnimation} />
                                </div>
                            )}
                        </div>
                    </div>
                )}
                <ToolCallsSummary calls={function_calls} isTurnFailure={isFailure} onApprove={onApprove} onReject={onReject} />

                {snippets.length > 0 && (
                    <div className="space-y-2 mt-2">
                        {snippets.map(snippet => (
                            <SnippetView key={snippet.id} snippet={snippet} />
                        ))}
                    </div>
                )}

                {isAssistantFinishedGenerating && (
                    <div className="flex gap-2">
                        <CopyButton text={text} />
                        <FeedbackButtons />
                    </div>
                )}
            </div>
        </div>
    )
}

export type { Turn, FunctionCallEvent, FailureDetails }
export { TurnView }

// Helpers

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000) // reset after 2s
        } catch (err) {
            console.error("Failed to copy:", err)
        }
    }

    return (
        <button onClick={handleCopy} className="rounded text-gray-500 transition-colors duration-200 hover:cursor-pointer hover:opacity-80 active:scale-95" aria-label="Copy to clipboard">
            {copied ? <CheckIcon className="w-4 h-4 text-green-500 animate-pop ring-1 ring-green-500/20 ring-opacity-50 rounded" /> : <DocumentDuplicateIcon className="w-4 h-4" />}
        </button>
    )
}

enum FeedbackState {
    None,
    Good,
    Bad
}

function FeedbackButtons({}: {}) {
    const [feedback, setFeedback] = useState<FeedbackState>(FeedbackState.None)

    const handleFeedback = (feedback: FeedbackState) => {
        setFeedback(feedback)
    }

    if (feedback === FeedbackState.None) {
        return (
            <>
                <button className="rounded text-gray-500 transition-colors duration-200 hover:cursor-pointer hover:opacity-80 active:scale-95" onClick={() => handleFeedback(FeedbackState.Good)}>
                    <HandThumbUpIcon className="h-4 w-4" />
                </button>
                <button className="rounded text-gray-500 transition-colors duration-200 hover:cursor-pointer hover:opacity-80 active:scale-95" onClick={() => handleFeedback(FeedbackState.Bad)}>
                    <HandThumbDownIcon className="h-4 w-4" />
                </button>
            </>
        )
    }

    if (feedback === FeedbackState.Good) {
        return (
            <div className="flex gap-2">
                <button className="rounded text-gray-500 transition-colors animate-pop">
                    <HandThumbUpFilledIcon className="h-4 w-4" />
                </button>
            </div>
        )
    }

    return (
        <div className="flex gap-2">
            <button className="rounded text-gray-500 transition-colors animate-pop">
                <HandThumbDownFilledIcon className="h-4 w-4" />
            </button>
        </div>
    )
}

function FilterResultView({ filterResult }: { filterResult: { isRelevant: boolean; reason: string; confidence: number } }) {
    const { isRelevant, reason, confidence } = filterResult

    // Determine confidence color for the progress circle
    const getConfidenceColor = (conf: number) => {
        if (conf >= 0.8) return "text-emerald-600 dark:text-emerald-400"
        if (conf >= 0.5) return "text-yellow-600 dark:text-yellow-400"
        return "text-orange-600 dark:text-orange-400"
    }

    // Calculate circle circumference for stroke-dasharray
    const radius = 6
    const circumference = 2 * Math.PI * radius

    return (
        <div className="select-text">
            <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                    <div className="rounded-lg border border-white/10 bg-stone-900/50 p-4">
                        <div className="flex items-start gap-3 mb-3">
                            {isRelevant ? (
                                <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                            ) : (
                                <XCircleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="text-sm font-semibold text-[#F1F1F1]">{isRelevant ? "Event Approved" : "Event Filtered Out"}</div>
                                    <div className="relative w-4 h-4 flex-shrink-0" title={`Confidence: ${Math.round(confidence * 100)}%`}>
                                        <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 16 16">
                                            {/* Background circle */}
                                            <circle cx="8" cy="8" r={radius} fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20" />
                                            {/* Progress circle */}
                                            <circle
                                                cx="8"
                                                cy="8"
                                                r={radius}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                className={getConfidenceColor(confidence)}
                                                strokeDasharray={circumference}
                                                strokeDashoffset={circumference * (1 - confidence)}
                                            />
                                        </svg>
                                    </div>
                                </div>
                                <div className="text-sm text-gray-300 whitespace-pre-wrap">{reason}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ContextWindowErrorView({ details }: { details: FailureDetails }) {
    const { userMessage, userGuidance, source, isRecoverable } = details

    // Get source-specific icon
    const getSourceIcon = () => {
        switch (source) {
            case "github":
                return (
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                )
            case "tool_output":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                )
            case "conversation_history":
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                )
            default:
                return (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                )
        }
    }

    return (
        <div className="select-text">
            <div className="rounded-lg border border-amber-500/30 bg-amber-900/20 p-4">
                <div className="flex items-start gap-3">
                    <div className="text-amber-400 flex-shrink-0 mt-0.5">{getSourceIcon()}</div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="text-sm font-semibold text-amber-300">Context Limit Exceeded</div>
                            {isRecoverable && <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">Recoverable</span>}
                        </div>

                        {userMessage && <div className="text-sm text-gray-200 mb-3">{userMessage}</div>}

                        {userGuidance && (
                            <div className="mt-3 pt-3 border-t border-amber-500/20">
                                <div className="text-xs font-medium text-amber-300 mb-1.5">What you can try:</div>
                                <div className="text-sm text-gray-300 whitespace-pre-wrap">{userGuidance}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
