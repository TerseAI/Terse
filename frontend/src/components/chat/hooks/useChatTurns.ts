import { useState, useRef, useEffect, ReactNode } from 'react';
import { Turn } from '../Turn';

interface UseChatTurnsOptions {
    onScrollToBottom?: () => void;
}

export function useChatTurns({ onScrollToBottom }: UseChatTurnsOptions = {}) {
    const [turns, setTurns] = useState<Turn[]>([]);
    const stepBuffersRef = useRef<Map<string, string>>(new Map());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pendingApprovalsRef = useRef<Set<string>>(new Set());
    const queuedToolCallsRef = useRef<Array<{ summary: string; step_id: string; parameters: string }>>([]);

    // Check if last turn is user. If so, we are waiting for an assistant response.
    const isPendingAssistantResponse = turns.length > 0 && turns[turns.length - 1].role === 'user';

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        onScrollToBottom?.();
    };

    useEffect(() => {
        scrollToBottom();
    }, [turns]);

    const handleDelta = ({ delta, step_id }: { delta: string; step_id: string }) => {
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

    const handleToolCall = ({ summary, step_id, parameters }: { summary: string; step_id: string; parameters: string }) => {
        console.log('🛠️ handleToolCall called with step_id:', step_id, 'name:', summary);
        
        // If there are pending approvals, queue this tool call
        if (pendingApprovalsRef.current.size > 0) {
            console.log('⏳ Queuing tool call due to pending approvals');
            queuedToolCallsRef.current.push({ summary, step_id, parameters });
            return;
        }

        setTurns(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            
            if (!last || last.step_id !== step_id) {
                console.log('🆕 Creating new turn for tool call:', step_id);
                return [...updated, { 
                    role: 'assistant', 
                    text: "", 
                    function_calls: [{ id: step_id, name: summary, isRunning: true, isWaitingForApproval: false }], 
                    isGenerating: true, 
                    step_id 
                }];
            }

            console.log('➕ Adding tool call to existing turn:', step_id);
            last.function_calls.push({ id: step_id, name: summary, isRunning: true, isWaitingForApproval: false });
            last.isGenerating = true;
            return updated;
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
                handleToolCall({ summary: call.summary, step_id: call.step_id, parameters: call.parameters });
            });
        }
    };

    const addCustomSnippet = (step_id: string, snippet: ReactNode) => {
        setTurns(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.step_id === step_id) {
                last.customSnippet = snippet;
            }
            return updated;
        });
    };

    const handleToolCallComplete = ({ step_id }: { status: string; step_id: string}) => {
        console.log('🔧 handleToolCallComplete called with step_id:', step_id);
        
        // Remove from pending approvals if it was there
        pendingApprovalsRef.current.delete(step_id);
        
        setTurns(prev => {
            console.log('🔍 Searching through turns for step_id:', step_id);
            console.log('📋 Current turns:', prev.map(turn => ({
                step_id: turn.step_id,
                function_calls: turn.function_calls.map(call => ({ id: call.id, name: call.name, isRunning: call.isRunning }))
            })));
            
            const updated = [...prev];
            // Search through all turns to find the tool call
            for (const turn of updated) {
                const toolCall = turn.function_calls.find(call => call.id === step_id);
                if (toolCall) {
                    console.log('✅ Found tool call to mark complete:', toolCall.name);
                    toolCall.isRunning = false;
                    toolCall.isWaitingForApproval = false;
                    break;
                }
            }
            return updated;
        });
    };

    const handleFailure = ({ error }: { error: string }) => {
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

    const addUserTurn = (message: string) => {
        const userTurn: Turn = { 
            role: 'user', 
            text: message, 
            function_calls: [], 
            step_id: 'user_turn' 
        };
        setTurns(prev => [...prev, userTurn]);
    };

    const clearTurns = () => {
        setTurns([]);
        stepBuffersRef.current.clear();
        pendingApprovalsRef.current.clear();
        queuedToolCallsRef.current = [];
    };

    return {
        turns,
        isPendingAssistantResponse,
        messagesEndRef,
        handleDelta,
        handleToolCall,
        handleToolApprovalRequest,
        handleToolApprovalResponse,
        handleToolCallComplete,
        handleFailure,
        handleNaturalStop,
        addUserTurn,
        clearTurns,
        scrollToBottom,
        addCustomSnippet
    };
} 