import { useState } from "react";
import { ClockIcon, XMarkIcon, PaperAirplaneIcon, CheckIcon, NoSymbolIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import Spin, { Size } from "../loading/Spin";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import ToolCallParameters from "../ToolCallParameters";
import { ChangedItem } from "../../shared/ModelEvents";
import { useRunHistoryActions } from "../../hooks/useRunHistoryActions";
import RunHistoryActionItem from "../RunHistory/RunHistoryActionItem";
import { EntityType } from "../../shared/Entities";
import { FunctionCallEvent } from "./Turn";
import { Button } from "../ui/button";

interface FunctionCallItemProps {
    call: FunctionCallEvent;
    isTurnFailure?: boolean;
    index: number;
    onApprove?: (stepId: string) => void;
    onReject?: (stepId: string) => void;
}

function ToolActionsDisplay({ changedItems, isTurnFailure }: { changedItems?: ChangedItem[], isTurnFailure?: boolean }) {
    if (!changedItems || changedItems.length === 0) return null;

    const actionIds = changedItems
        .filter(item => item.type_name === EntityType.RUN_HISTORY_ACTION)
        .map(item => item.id);

    if (actionIds.length === 0) return null;

    return <ToolActionsList actionIds={actionIds} isTurnFailure={isTurnFailure} />;
}

function ToolActionsList({ actionIds, isTurnFailure }: { actionIds: string[], isTurnFailure?: boolean }) {
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
                    runStatus={isTurnFailure ? "failed" : "success"}
                    isExpanded={expandedActions.has(`${action.id}-action-${index}`)}
                    onToggle={toggleAction}
                />
            ))}
        </div>
    );
}

function ToolResultInput({ toolName, parameters, onSubmit }: { toolName: string; parameters?: string; onSubmit: (result: string) => void }) {
    const [result, setResult] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [submittedValue, setSubmittedValue] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
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
            <div className="bg-card rounded-lg p-3 mt-2 border border-green-500/20">
                <div className="text-sm text-muted-foreground mb-2">
                    Result provided for <span className="font-medium text-foreground">{toolName}</span>:
                </div>
                <div className="flex items-center gap-2">
                    <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-foreground font-mono bg-background px-2 py-1 rounded select-text">
                        {submittedValue}
                    </span>
                </div>
            </div>
        );
    }

    // Show input form if not submitted yet
    return (
        <div className="bg-card rounded-lg p-3 mt-2">
            <div className="text-sm text-muted-foreground mb-2">
                Please provide the result for <span className="font-medium text-foreground">{toolName}</span>:
            </div>

            {parameters && parsedParams && typeof parsedParams === 'object' && Object.keys(parsedParams).length > 0 && (
                <div className="mb-3 p-2 bg-background rounded border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Parameters:</div>
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono select-text">
                        {JSON.stringify(parsedParams, null, 2)}
                    </pre>
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-[1fr_auto] gap-2">
                <input
                    type="text"
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    placeholder="Enter tool result..."
                    className="w-full text-foreground text-sm resize-none p-2.5 leading-normal placeholder:italic placeholder:text-muted-foreground rounded-lg transition-all duration-300 focus:outline-none bg-card"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={!result.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-1"
                >
                    <PaperAirplaneIcon className="w-4 h-4" />
                    Send
                </button>
            </form>
        </div>
    );
}

export default function FunctionCallItem({ call, isTurnFailure = false, index, onApprove, onReject }: FunctionCallItemProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const callKey = `function-call-${call.id}-${index}`;

    const handleApprove = () => {
        if (!onApprove) {
            console.error('No onApprove handler available');
            return;
        }
        onApprove(call.id);
    };

    const handleReject = () => {
        if (!onReject) {
            console.error('No onReject handler available');
            return;
        }
        onReject(call.id);
    };

    return (
        <div className="space-y-2 w-full max-w-lg">
            <Accordion
                type="single"
                collapsible
                value={isExpanded ? callKey : ""}
                onValueChange={(value) => setIsExpanded(value === callKey)}
            >
                <div className="rounded-lg border border-border">
                    <AccordionItem value={callKey} className="border-b-0 w-full">
                        <AccordionTrigger className="py-2 px-2 hover:no-underline w-full">
                            <div className="flex items-center gap-2 w-full mr-2">
                                {call.isWaitingForApproval ? (
                                    <ClockIcon className="w-4 h-4 text-primary flex-shrink-0" />
                                ) : call.isRejected ? (
                                    <NoSymbolIcon className="w-4 h-4 text-orange-500 flex-shrink-0" />
                                ) : call.isFailure ? (
                                    <XMarkIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
                                ) : call.isApproved ? (
                                    <CheckCircleIcon className="w-4 h-4 text-primary flex-shrink-0" />
                                ) : call.isWaitingForUserInput ? (
                                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                ) : call.isRunning ? (
                                    <Spin size={Size.Tiny} />
                                ) : (
                                    <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                <div className="text-sm flex-1 text-left min-w-0 overflow-hidden">
                                    <span className="truncate block">
                                        {call.name}
                                        {call.isWaitingForApproval && (
                                            <span className="text-yellow-500 ml-1">(waiting for approval)</span>
                                        )}
                                        {call.isApproved && (
                                            <span className="text-primary ml-1">(approved)</span>
                                        )}
                                        {call.isRejected && (
                                            <span className="text-orange-500 ml-1">(rejected)</span>
                                        )}
                                        {call.isWaitingForUserInput && (
                                            <span className="text-blue-500 ml-1">(waiting for your input)</span>
                                        )}
                                    </span>
                                    {call.result && !call.isWaitingForUserInput && (
                                        <span className="text-muted-foreground ml-2 font-mono bg-background px-2 py-0.5 rounded text-xs whitespace-nowrap">
                                            → {call.result}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="pt-2 pl-4 pr-4 space-y-2 w-full">
                                {call.parameters && (
                                    <div>
                                        <ToolCallParameters parameters={call.parameters} />
                                    </div>
                                )}
                                {call.errorContext && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                        <div className="text-sm font-semibold text-red-500 mb-1">Error:</div>
                                        <div className="text-sm text-red-400 font-mono whitespace-pre-wrap select-text">
                                            {String(call.errorContext.error)}
                                        </div>
                                    </div>
                                )}
                                <ToolActionsDisplay changedItems={call.changed_items} isTurnFailure={isTurnFailure} />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </div>
            </Accordion>
            {call.isWaitingForUserInput && (
                <ToolResultInput
                    toolName={call.name}
                    parameters={call.parameters}
                    onSubmit={() => {}}
                />
            )}
            {call.isWaitingForApproval && !call.isRejected && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-2">
                    <div className="text-sm font-semibold text-yellow-500 mb-2">
                        Approval Required
                    </div>
                    <div className="text-sm text-muted-foreground mb-3">
                        The bot wants to execute: <span className="font-medium text-foreground">{call.name}</span>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handleApprove}
                            size="sm"
                            variant="default"
                        >
                            Approve
                        </Button>
                        <Button
                            onClick={handleReject}
                            size="sm"
                            variant="destructive"
                        >
                            Reject
                        </Button>
                    </div>
                </div>
            )}
            {call.isApproved && !call.isRunning && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-2 text-sm text-primary">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>Approved</span>
                    </div>
                </div>
            )}
            {call.isRejected && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-2 text-sm text-orange-500">
                        <NoSymbolIcon className="w-4 h-4" />
                        <span>Rejected</span>
                    </div>
                </div>
            )}
        </div>
    );
}

