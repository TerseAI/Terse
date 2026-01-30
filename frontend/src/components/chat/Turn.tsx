import { HandThumbUpIcon, HandThumbDownIcon, CheckIcon, DocumentDuplicateIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpFilledIcon, HandThumbDownIcon as HandThumbDownFilledIcon } from '@heroicons/react/24/solid';
import { useState } from "react";
import TokenStream from "./TokenStream";

import { ChangedItem, SharedErrorContext, ChatSnippet } from "../../shared/ModelEvents";
import FunctionCallItem from "./FunctionCallItem";
import { SnippetView } from "./SnippetView";

interface Turn {
    role: 'user' | 'assistant';
    text: string;
    function_calls: FunctionCallEvent[];
    step_id: string;
    isFailure?: boolean;
    isGenerating?: boolean;
    isThinking?: boolean;
    filter_result?: {
        isRelevant: boolean;
        reason: string;
        confidence: number;
    };
    snippets?: ChatSnippet[];
    disableAnimation?: boolean;
    onApprove?: (stepId: string) => void;
    onReject?: (stepId: string) => void;
}

interface FunctionCallEvent {
    id: string;
    name: string;
    isRunning: boolean;
    isWaitingForApproval?: boolean;
    isRejected?: boolean;
    isApproved?: boolean;
    isWaitingForUserInput?: boolean;
    isFailure?: boolean;
    parameters?: string;
    result?: string;
    changed_items?: ChangedItem[];
    errorContext?: SharedErrorContext;
}

function TurnView({ role, text, function_calls, isFailure = false, isGenerating = false, isThinking = false, filter_result, snippets = [], disableAnimation = false, onApprove, onReject }: Turn) {
    const isUser = role === 'user';
    const isAssistantFinishedGenerating = !isGenerating && role === 'assistant' && text.length > 0;
    // Expanded state - show all steps with status
    return (
        <div className={`flex rounded-lg ${isUser ? 'justify-end animate-in fade-in-0' : 'justify-start'}`}>
            <div className="space-y-2 max-w-[90%]">
                {filter_result && (
                    <FilterResultView filterResult={filter_result} />
                )}

                {isThinking && (
                    <div className="text-[#F1F1F1] text-md py-2 rounded-8xl">
                        <div className="prose prose-invert">
                            <div className="flex items-center gap-2 text-gray-400 italic">
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                {(text || isFailure) && (
                    <div className="text-[#F1F1F1] text-md py-2 rounded-8xl select-text">
                        <div className={`prose prose-invert ${isUser ? 'bg-stone-900/80 rounded-lg p-3' : ''}`}>
                            {isFailure && (
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
                {function_calls.map((call, index) => (
                    <FunctionCallItem
                        key={index}
                        call={call}
                        isTurnFailure={isFailure}
                        index={index}
                        onApprove={onApprove}
                        onReject={onReject}
                    />
                ))}

                {snippets.length > 0 && (
                    <div className="space-y-2 mt-2">
                        {snippets.map((snippet) => (
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
    );
}


export type { Turn, FunctionCallEvent };
export { TurnView };

// Helpers

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
