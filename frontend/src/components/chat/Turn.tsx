import Spin, { Size } from "../Spin";
import { HandThumbUpIcon, HandThumbDownIcon, CheckIcon, DocumentDuplicateIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { HandThumbUpIcon as HandThumbUpFilledIcon, HandThumbDownIcon as HandThumbDownFilledIcon } from '@heroicons/react/24/solid';
import { ReactNode, useState, useRef, useEffect } from "react";
import TokenStream from "./TokenStream";
import { useSnippetNavigationContext } from "../../context/SnippetNavigationContext";
import { Type } from "../../utility/Types";

interface Turn {
    role: 'user' | 'assistant';
    text: string;
    function_calls: FunctionCallEvent[];
    step_id: string;
    isFailure?: boolean;
    items?: ItemToDisplay[];    
    customSnippet?: ReactNode;
    isGenerating?: boolean;
    turnIndex?: number;
}

interface ItemToDisplay {
    type: Type;
    id: number;
}

interface FunctionCallEvent {
    id: string;
    name: string;
    isRunning: boolean;
    isWaitingForApproval?: boolean;
    isRejected?: boolean;
}

function TurnView({ role, text, function_calls, isFailure = false, items, isGenerating = false, customSnippet, step_id, turnIndex = 0 }: Turn) {
    const isUser = role === 'user';
    const isAssistantFinishedGenerating = !isGenerating && role === 'assistant' && text.length > 0;

    // Expanded state - show all steps with status
    return (
        <div className={`flex rounded-lg ${isUser ? 'justify-end animate-fade-in' : 'justify-start'}`}>
            <div className="space-y-1 max-w-[80%]">
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
                            <TokenStream text={text} />
                        )}
                    </div>
                </div>
                {function_calls.map((call, index) => (
                    <div key={index} className="flex items-center gap-2">
                        {call.isWaitingForApproval ? (
                            <ClockIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        ) : call.isRejected ? (
                            <XMarkIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                        ) : !call.isRunning ? (
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        </div>
                    </div>
                ))}
                {items && items.map((item, index) => (
                    <div key={index} className="text-sm animate-slide-in animate-fade-in">
                        <ItemView item={item} turnIndex={turnIndex} itemIndex={index} step_id={step_id} isGenerating={isGenerating} role={role} />
                    </div>
                ))}
                {customSnippet && (
                    <div className="animate-slide-in animate-fade-in">
                        {customSnippet}
                    </div>
                )}

                {isAssistantFinishedGenerating && (
                    <div className="flex gap-2">
                        <CopyButton text={text} />
                        <FeedbackButtons text={text} />
                    </div>
                )}
            </div>
        </div>
    );
}

function ItemView({ item, turnIndex, itemIndex, step_id, isGenerating, role }: { 
    item: ItemToDisplay; 
    turnIndex: number; 
    itemIndex: number; 
    step_id: string; 
    isGenerating: boolean; 
    role: 'user' | 'assistant'; 
}) {
    const navigation = useSnippetNavigationContext();
    const elementRef = useRef<HTMLDivElement>(null);
    const snippetIndexRef = useRef<number | null>(null);
    const isRegisteredRef = useRef(false);
    const elementUpdatedRef = useRef(false);

    // Register snippet in effect to avoid setState during render
    useEffect(() => {
        if (!isRegisteredRef.current) {
            const snippetIndex = navigation.registerSnippet({
                turnIndex,
                itemIndex,
                type: item.type,
                id: item.id,
                turnId: step_id,
                isGenerating,
                role
            });
            snippetIndexRef.current = snippetIndex;
            isRegisteredRef.current = true;
        }
    }, []); // Empty dependency array - only run once

    // Update element reference in effect to avoid setState during render
    useEffect(() => {
        if (elementRef.current && snippetIndexRef.current !== null && !elementUpdatedRef.current) {
            navigation.updateSnippetElement(snippetIndexRef.current, elementRef.current);
            elementUpdatedRef.current = true;
        }
    });

    // Check if this snippet is selected
    const isSelected = navigation.selectedSnippetIndex === snippetIndexRef.current;

    const Component = item.type.component(item.id);
    return (
        <div 
            ref={elementRef}
            className={`transition-all duration-200 ${
                isSelected 
                    ? 'shadow-xl bg-white/5 scale-[1.02] rounded-lg p-1' 
                    : 'hover:bg-white/5 rounded-lg p-1'
            }`}
        >
            {Component}
        </div>
    );
}

export type { Turn, FunctionCallEvent, ItemToDisplay };
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

function FeedbackButtons({ }: { text: string }) {
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