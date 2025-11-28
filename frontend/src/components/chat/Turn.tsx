import Spin, { Size } from "../loading/Spin";
import { HandThumbUpIcon, HandThumbDownIcon, CheckIcon, DocumentDuplicateIcon, ClockIcon, XMarkIcon, PaperAirplaneIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpFilledIcon, HandThumbDownIcon as HandThumbDownFilledIcon } from '@heroicons/react/24/solid';
import { useState } from "react";
import TokenStream from "./TokenStream";

import { ChangedItem } from "../../shared/ModelEvents";
import { useRunHistoryActions } from "../../hooks/useRunHistoryActions";
import RunHistoryActionItem from "../RunHistory/RunHistoryActionItem";
import { EntityType } from "../../shared/Entities";

interface Turn {
    role: 'user' | 'assistant';
    text: string;
    function_calls: FunctionCallEvent[];
    step_id: string;
    isFailure?: boolean;
    isGenerating?: boolean;
    filter_result?: {
        isRelevant: boolean;
        reason: string;
        confidence: number;
    };
    disableAnimation?: boolean;
}

interface FunctionCallEvent {
    id: string;
    name: string;
    isRunning: boolean;
    isWaitingForApproval?: boolean;
    isRejected?: boolean;
    isWaitingForUserInput?: boolean;
    parameters?: string;
    result?: string;
    changed_items?: ChangedItem[];
}

function TurnView({ role, text, function_calls, isFailure = false, isGenerating = false, filter_result, disableAnimation = false }: Turn) {
    const isUser = role === 'user';
    const isAssistantFinishedGenerating = !isGenerating && role === 'assistant' && text.length > 0;
    // Expanded state - show all steps with status
    return (
        <div className={`flex rounded-lg ${isUser ? 'justify-end animate-fade-in' : 'justify-start'}`}>
            <div className="space-y-1 max-w-[80%]">
                {filter_result && (
                    <FilterResultView filterResult={filter_result} />
                )}

                <div className="text-[#F1F1F1] text-md py-2 rounded-8xl">
                    <div className={`prose prose-invert ${isUser ? 'bg-stone-900/80 rounded-lg p-3' : ''}`}>
                        {isFailure && (
                            <svg className="w-4 h-4 text-red-500 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                        {isUser ? (
                            <span>{text}</span>
                        ) : (
                            <TokenStream text={text} disableAnimation={disableAnimation} />
                        )}
                    </div>
                </div>
                {function_calls.map((call, index) => (
                    <div key={index} className="space-y-2">
                        <div className="flex items-center gap-2">
                            {call.isWaitingForApproval ? (
                                <ClockIcon className="w-4 h-4 text-[theme(--accent-secondary)] flex-shrink-0" />
                            ) : call.isRejected ? (
                                <XMarkIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                            ) : call.isWaitingForUserInput ? (
                                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            ) : !call.isRunning ? (
                                <svg className="w-4 h-4 text-[theme(--accent-secondary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <Spin size={Size.Tiny} />
                            )}
                            <div className="text-sm">
                                {call.name}
                                {call.isWaitingForApproval && (
                                    <span className="text-yellow-500 ml-1">(waiting for approval)</span>
                                )}
                                {call.isRejected && (
                                    <span className="text-red-500 ml-1">(rejected)</span>
                                )}
                                {call.isWaitingForUserInput && (
                                    <span className="text-blue-500 ml-1">(waiting for your input)</span>
                                )}
                                {call.result && !call.isWaitingForUserInput && (
                                    <span className="text-[theme(text-secondary)] ml-2 font-mono bg-[theme(background-primary)] px-2 py-0.5 rounded text-xs">
                                        → {call.result}
                                    </span>
                                )}
                            </div>
                        </div>
                        {call.isWaitingForUserInput && (
                            <ToolResultInput
                                stepId={call.id}
                                toolName={call.name}
                                parameters={call.parameters}
                                onSubmit={(result) => {
                                    console.log('🔍 Tool result submitted:', result);
                                }}
                            />
                        )}
                        <ToolActionsDisplay changedItems={call.changed_items} isFailure={isFailure} />
                    </div>
                ))}

                {isAssistantFinishedGenerating && (
                    <div className="flex gap-2">
                        <CopyButton text={text} />
                        <FeedbackButtons />
                    </div>
                )}
            </div>
        </div>
    );
}


export type { Turn, FunctionCallEvent };
export { TurnView };

// Helpers

function ToolActionsDisplay({ changedItems, isFailure }: { changedItems?: ChangedItem[], isFailure?: boolean }) {
    if (!changedItems || changedItems.length === 0) return null;

    const actionIds = changedItems
        .filter(item => item.type_name === EntityType.RUN_HISTORY_ACTION)
        .map(item => item.id);

    if (actionIds.length === 0) return null;

    return <ToolActionsList actionIds={actionIds} isFailure={isFailure} />;
}

function ToolActionsList({ actionIds, isFailure }: { actionIds: string[], isFailure?: boolean }) {
    const { actions } = useRunHistoryActions(actionIds);
    const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set());

    const toggleAction = (actionKey: string) => {
        const newExpanded = new Set(expandedActions);
        if (newExpanded.has(actionKey)) {
            newExpanded.delete(actionKey);
        } else {
            newExpanded.add(actionKey);
        }
        setExpandedActions(newExpanded);
    };

    if (!actions || actions.length === 0) return null;

    return (
        <div className="mt-2 space-y-2">
            {actions.map((action, index) => (
                <RunHistoryActionItem
                    key={action.id}
                    runId={action.id} 
                    index={index}
                    action={action}
                    runStatus={isFailure ? "failed" : "success"}
                    isExpanded={expandedActions.has(`${action.id}-action-${index}`)}
                    onToggle={toggleAction}
                />
            ))}
        </div>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // reset after 2s
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <button
            onClick={handleCopy}
            className="rounded text-gray-500 transition-colors duration-200 hover:cursor-pointer hover:opacity-80 active:scale-95"
            aria-label="Copy to clipboard"
        >
            {copied ? (
                <CheckIcon className="w-4 h-4 text-green-500 animate-pop ring-1 ring-green-500/20 ring-opacity-50 rounded" />
            ) : (
                <DocumentDuplicateIcon className="w-4 h-4" />
            )}
        </button>
    );
}

enum FeedbackState {
    None,
    Good,
    Bad
}

function FeedbackButtons({ }: {}) {
    const [feedback, setFeedback] = useState<FeedbackState>(FeedbackState.None);

    const handleFeedback = (feedback: FeedbackState) => {
        setFeedback(feedback);
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
        );
    }

    if (feedback === FeedbackState.Good) {
        return (
            <div className="flex gap-2">
                <button className="rounded text-gray-500 transition-colors animate-pop">
                    <HandThumbUpFilledIcon className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            <button className="rounded text-gray-500 transition-colors animate-pop">
                <HandThumbDownFilledIcon className="h-4 w-4" />
            </button>
        </div>
    );
}

function ToolResultInput({ toolName, parameters, onSubmit }: { stepId: string; toolName: string; parameters?: string; onSubmit: (result: string) => void }) {
    const [result, setResult] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submittedValue, setSubmittedValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        console.log('🔍 Tool result input submitted:', result);
        e.preventDefault();
        if (result.trim()) {
            setSubmittedValue(result.trim());
            setSubmitted(true);
            onSubmit(result.trim());
            setResult('');
        }
    };

    // Parse parameters if they exist
    let parsedParams = null;
    if (parameters) {
        try {
            parsedParams = JSON.parse(parameters);
        } catch (e) {
            // If parsing fails, treat as plain text
            parsedParams = parameters;
        }
    }

    // Show collapsed view if submitted
    if (submitted) {
        return (
            <div className="bg-[theme(background-elevated)] rounded-lg p-3 mt-2 border border-green-500/20">
                <div className="text-sm text-[theme(text-secondary)] mb-2">
                    Result provided for <span className="font-medium text-[theme(text-primary)]">{toolName}</span>:
                </div>
                <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-[theme(text-primary)] font-mono bg-[theme(background-primary)] px-2 py-1 rounded">
                        {submittedValue}
                    </span>
                </div>
            </div>
        );
    }

    // Show input form if not submitted yet
    return (
        <div className="bg-[theme(background-elevated)] rounded-lg p-3 mt-2">
            <div className="text-sm text-[theme(text-secondary)] mb-2">
                Please provide the result for <span className="font-medium text-[theme(text-primary)]">{toolName}</span>:
            </div>

            {parameters && (
                <div className="mb-3 p-2 bg-[theme(background-primary)] rounded border border-[theme(border-secondary)]">
                    <div className="text-xs text-[theme(text-secondary)] mb-1">Parameters:</div>
                    <pre className="text-xs text-[theme(text-primary)] whitespace-pre-wrap font-mono">
                        {typeof parsedParams === 'object' ? JSON.stringify(parsedParams, null, 2) : parsedParams}
                    </pre>
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-[1fr_auto] gap-2">
                <input
                    type="text"
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    placeholder="Enter tool result..."
                    className="w-full text-[theme(text-primary)] text-sm resize-none p-2.5 leading-normal placeholder:italic placeholder:text-[theme(text-secondary)] rounded-lg transition-all duration-300 focus:outline-none bg-[theme(background-elevated)]"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={!result.trim()}
                    className="px-4 py-2 bg-[theme(--accent-primary)] text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1"
                >
                    <PaperAirplaneIcon className="w-4 h-4" />
                    Send
                </button>
            </form>
        </div>
    );
}

function FilterResultView({ filterResult }: { filterResult: { isRelevant: boolean; reason: string; confidence: number; } }) {
    const { isRelevant, reason, confidence } = filterResult;
    
    // Determine confidence color for the progress circle
    const getConfidenceColor = (conf: number) => {
        if (conf >= 0.8) return 'text-emerald-600 dark:text-emerald-400';
        if (conf >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-orange-600 dark:text-orange-400';
    };
    
    // Calculate circle circumference for stroke-dasharray
    const radius = 6;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="mb-4 select-text">
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
                                    <div className="text-sm font-semibold text-[#F1F1F1]">
                                        {isRelevant ? 'Event Approved' : 'Event Filtered Out'}
                                    </div>
                                    <div 
                                        className="relative w-4 h-4 flex-shrink-0"
                                        title={`Confidence: ${Math.round(confidence * 100)}%`}
                                    >
                                        <svg className="w-4 h-4 transform -rotate-90" viewBox="0 0 16 16">
                                            {/* Background circle */}
                                            <circle
                                                cx="8"
                                                cy="8"
                                                r={radius}
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                className="text-white/20"
                                            />
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
    );
}
