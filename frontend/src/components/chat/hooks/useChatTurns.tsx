import { useState, useRef, useEffect } from 'react';
import { type Turn } from '../Turn';
import { type TextDelta, type ToolCall, type ToolCallComplete, type Failure, FilterResult } from '../../../shared/ModelEvents';
import { filterOutThinkingOnlyTurns } from '../utils/turnUtils';

interface UseChatTurnsOptions {
    initialTurns?: Turn[] | undefined;
}

export function useChatTurns({ initialTurns }: UseChatTurnsOptions = {}) {
    const [turns, setTurns] = useState<Turn[]>(initialTurns || []);
    const stepBuffersRef = useRef<Map<string, string>>(new Map());
    const pendingApprovalsRef = useRef<Set<string>>(new Set());
    const queuedToolCallsRef = useRef<Array<{ summary: string; step_id: string; parameters: string }>>([]);

    useEffect(() => {
        if (initialTurns && initialTurns.length > 0) {
            setTurns(prev => {
                // Create a map of initialTurns by step_id for quick lookup
                const initialTurnsMap = new Map<string, Turn>();
                initialTurns.forEach(turn => {
                    initialTurnsMap.set(turn.step_id, turn);
                });

                // Collect turns from existing that don't exist in initialTurns
                const uniqueExistingTurns = prev.filter(turn => !initialTurnsMap.has(turn.step_id));

                return [...initialTurns, ...uniqueExistingTurns];
            });
        }
    }, [initialTurns]);

    const isPendingAssistantResponse = (
        turns.length > 0 && (
            turns[turns.length - 1]?.role === 'user' ||
            turns[turns.length - 1]?.isGenerating
        ) || false
    );

    const handleDelta = ({ delta, step_id }: TextDelta) => {
        // Merge delta into buffer
        const existing = stepBuffersRef.current.get(step_id) ?? '';
        const newText = existing + delta;
        stepBuffersRef.current.set(step_id, newText);

        setTurns(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];

            if (!last || last.step_id !== step_id) {
                return [...updated, {
                    role: 'assistant',
                    text: newText,
                    function_calls: [],
                    isGenerating: true,
                    step_id,
                }];
            }
            last.text = newText;
            last.isGenerating = true;
            return updated;
        });
    };

    const handleToolCall = ({ summary, step_id, parameters }: ToolCall) => {
        setTurns(prev => {
            // Find the turn with the matching step_id
            const existingTurnIndex = prev.findIndex(turn => turn.step_id === step_id);

            if (existingTurnIndex === -1) {
                return [...prev, {
                    role: 'assistant',
                    text: "",
                    function_calls: [{ id: step_id, name: summary, isRunning: false, isWaitingForApproval: false, isWaitingForUserInput: false, parameters }],
                    isGenerating: true,
                    step_id,
                }];
            }

            const existingTurn = prev[existingTurnIndex];

            // Check if this tool call already exists
            const existingCallIndex = existingTurn.function_calls.findIndex(call => call.id === step_id && call.name === summary);
            if (existingCallIndex !== -1) {
                // Update existing tool call with new parameters
                const updatedTurn = {
                    ...existingTurn,
                    function_calls: existingTurn.function_calls.map((call, index) =>
                        index === existingCallIndex
                            ? { ...call, parameters }
                            : call
                    )
                };

                return [
                    ...prev.slice(0, existingTurnIndex),
                    updatedTurn,
                    ...prev.slice(existingTurnIndex + 1)
                ];
            }

            // Create new turn with added tool call (immutable update)
            const updatedTurn = {
                ...existingTurn,
                function_calls: [...existingTurn.function_calls, { id: step_id, name: summary, isRunning: false, isWaitingForApproval: false, isWaitingForUserInput: false, parameters }],
                isGenerating: true
            };

            // Create new turns array with updated turn (immutable update)
            return [
                ...prev.slice(0, existingTurnIndex),
                updatedTurn,
                ...prev.slice(existingTurnIndex + 1)
            ];
        });
    };

    const handleToolApprovalRequest = ({ step_id }: { step_id: string; name: string; arguments: string }) => {
        // Mark this tool call as waiting for approval
        pendingApprovalsRef.current.add(step_id);

        setTurns(prev => {
            const updated = [...prev];
            // Find the tool call that needs approval
            for (const turn of updated) {
                const toolCall = turn.function_calls.find(call => call.id === step_id);
                if (toolCall) {
                    toolCall.isRunning = false;
                    toolCall.isWaitingForApproval = true;
                    break;
                }
            }
            return updated;
        });
    };

    const handleToolApprovalResponse = ({ step_id, approved }: { step_id: string; approved: boolean }) => {
        // Remove from pending approvals
        pendingApprovalsRef.current.delete(step_id);

        if (approved) {
            // Mark as running again
            setTurns(prev => {
                const updated = [...prev];
                for (const turn of updated) {
                    const toolCall = turn.function_calls.find(call => call.id === step_id);
                    if (toolCall) {
                        toolCall.isRunning = true;
                        toolCall.isWaitingForApproval = false;
                        break;
                    }
                }
                return updated;
            });
        } else {
            // Mark as failed/rejected
            setTurns(prev => {
                const updated = [...prev];
                for (const turn of updated) {
                    const toolCall = turn.function_calls.find(call => call.id === step_id);
                    if (toolCall) {
                        toolCall.isRunning = false;
                        toolCall.isWaitingForApproval = false;
                        toolCall.isRejected = true;
                        break;
                    }
                }
                return updated;
            });
        }

        // Process any queued tool calls now that approval is resolved
        if (pendingApprovalsRef.current.size === 0 && queuedToolCallsRef.current.length > 0) {
            const queuedCalls = [...queuedToolCallsRef.current];
            queuedToolCallsRef.current = [];

            // Process each queued tool call
            queuedCalls.forEach(call => {
                handleToolCall({ summary: call.summary, step_id: call.step_id, parameters: call.parameters, integration: 'unknown' });
            });
        }
    };

    const handleToolCallComplete = ({ step_id, result, changed_items, errorContext }: ToolCallComplete) => {
        // Remove from pending approvals if it was there
        pendingApprovalsRef.current.delete(step_id);

        setTurns(prev => {

            const updated = [...prev];
            // Search through all turns to find the tool call
            for (const turn of updated) {
                const toolCall = turn.function_calls.find(call => call.id === step_id);
                if (toolCall) {
                    toolCall.isRunning = false;
                    toolCall.isWaitingForApproval = false;
                    toolCall.isWaitingForUserInput = false;
                    if (result) {
                        toolCall.result = result;
                    }
                    if (errorContext) {
                        toolCall.isFailure = true;
                        toolCall.errorContext = errorContext;
                    }
                    if (changed_items) {
                        toolCall.changed_items = changed_items;
                    }
                    break;
                }
            }
            return updated;
        });
    };

    const handleFailure = ({ error }: Failure) => {
        setTurns(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
                last.isGenerating = false;
            }
            return [...updated, {
                role: 'assistant',
                text: `Something went wrong. Please try again. ${error}`,
                function_calls: [],
                step_id: '',
                isFailure: true
            }];
        });
    };

    const handleNaturalStop = () => {
        setTurns(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
                last.isGenerating = false;
            }
            return updated;
        });
    };

    const handleFilterResult = ({ isRelevant, reason, confidence }: FilterResult) => {
        setTurns(prev => {
            const updated = [...prev];
            return [...updated, {
                role: 'assistant',
                text: '',
                function_calls: [],
                step_id: 'filter',
                isGenerating: isRelevant ? true : false,
                filter_result: {
                    isRelevant,
                    reason,
                    confidence
                }
            }];
        });
    };

    const handleThinking = (stepId: string) => {
        setTurns(prev => {
            const last = prev[prev.length - 1];
            if (last && last.step_id === stepId && !last.text && last.function_calls.length === 0) {
                // Update existing turn
                return prev.map(t => t === last ? { ...t, isThinking: true, isGenerating: true } : t);
            }
            // Create new thinking turn
            return [...prev, {
                role: 'assistant',
                text: '',
                function_calls: [],
                step_id: stepId,
                isThinking: true,
                isGenerating: true
            }];
        });
    };

    const addUserTurn = (message: string) => {
        
        const userTurn: Turn = {
            role: 'user',
            text: message,
            function_calls: [],
            step_id: 'user_turn'
        };
        setTurns(prev => {
            return [...prev, userTurn];
        });
    };

    const clearTurns = () => {
        setTurns([]);
        stepBuffersRef.current.clear();
        pendingApprovalsRef.current.clear();
        queuedToolCallsRef.current = [];
    };

    return {
        turns: filterOutThinkingOnlyTurns(turns),
        isPendingAssistantResponse,
        handleDelta,
        handleToolCall,
        handleToolApprovalRequest,
        handleToolApprovalResponse,
        handleToolCallComplete,
        handleFailure,
        handleNaturalStop,
        handleFilterResult,
        handleThinking,
        addUserTurn,
        clearTurns,
    };
} 