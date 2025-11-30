import { useMemo } from 'react';
import { type Turn } from '../../../chat/Turn';
import type { ModelEvent, ToolCall, ToolCallComplete, TextDelta, Failure, FilterResult } from '../../../../shared/ModelEvents';

export function useRunHistoryTurns(events: (ModelEvent & { isHistorical?: boolean })[]): Turn[] {
    return useMemo(() => {
        const turns: Turn[] = [];
        const stepBuffers = new Map<string, string>();

        // Helper to find or create the appropriate turn
        const getOrCreateTurn = (role: 'assistant' | 'user', step_id: string): Turn => {
            const lastTurn = turns[turns.length - 1];
            
            // If last turn matches role and (for assistant) step_id, use it
            if (lastTurn && lastTurn.role === role && (role === 'user' || lastTurn.step_id === step_id)) {
                return lastTurn;
            }
            
            // Create new turn
            const newTurn: Turn = {
                role,
                text: '',
                function_calls: [],
                step_id,
                isGenerating: role === 'assistant'
            };
            turns.push(newTurn);
            return newTurn;
        };

        // Track which step_ids have been completed (have ToolCallComplete or NaturalStop)
        const completedStepIds = new Set<string>();
        // Track if we're processing only historical events
        const allHistorical = events.length > 0 && events.every(e => e.isHistorical);

        events.forEach(event => {
            switch (event.type) {
                case 'FilterResult': {
                    const e = event as FilterResult;
                    turns.push({
                        role: 'assistant',
                        text: '',
                        function_calls: [],
                        step_id: 'filter',
                        isGenerating: false,
                        filter_result: {
                            isRelevant: e.isRelevant,
                            reason: e.reason,
                            confidence: e.confidence
                        },
                        disableAnimation: event.isHistorical
                    });
                    break;
                }
                case 'TextDelta': {
                    const e = event as TextDelta;
                    const step_id = e.step_id;
                    const existing = stepBuffers.get(step_id) ?? '';
                    const newText = existing + e.delta;
                    stepBuffers.set(step_id, newText);
                    
                    const turn = getOrCreateTurn('assistant', step_id);
                    turn.text = newText;
                    // For historical events, don't set isGenerating to true
                    // We'll finalize it at the end based on completion status
                    if (!event.isHistorical) {
                        turn.isGenerating = true;
                    }
                    if (event.isHistorical) {
                        turn.disableAnimation = true;
                    }
                    break;
                }
                case 'ToolCall': {
                    const e = event as ToolCall;
                    const step_id = e.step_id;
                    const turn = getOrCreateTurn('assistant', step_id);
                    
                    if (event.isHistorical) {
                        turn.disableAnimation = true;
                    }

                    const existingCall = turn.function_calls.find(c => c.id === step_id);
                    if (!existingCall) {
                        turn.function_calls.push({
                            id: step_id,
                            name: e.summary,
                            // For historical events, start with isRunning: false
                            // since we'll see ToolCallComplete soon
                            isRunning: event.isHistorical ? false : true,
                            parameters: e.parameters,
                            isWaitingForUserInput: false
                        });
                    } else {
                        existingCall.parameters = e.parameters;
                    }
                    // For historical events, don't set isGenerating to true
                    if (!event.isHistorical) {
                        turn.isGenerating = true;
                    }
                    break;
                }
                case 'ToolCallComplete': {
                    const e = event as ToolCallComplete;
                    const step_id = e.step_id;
                    completedStepIds.add(step_id);
                    let found = false;
                    // Find the call in any turn
                    for (const t of turns) {
                        const fc = t.function_calls.find(c => c.id === step_id);
                        if (fc) {
                            fc.isRunning = false;
                            fc.result = e.result;
                            fc.isWaitingForUserInput = false;
                            if (e.changed_items) {
                                fc.changed_items = e.changed_items;
                            }
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        // ToolCallComplete arrived without a preceding ToolCall (e.g., from historical events)
                        // Create the function call directly in completed state
                        const turn = getOrCreateTurn('assistant', step_id);
                        turn.function_calls.push({
                            id: step_id,
                            name: e.tool_name,
                            isRunning: false,
                            result: e.result,
                            changed_items: e.changed_items,
                            isWaitingForUserInput: false
                        });
                    }
                    break;
                }
                case 'ToolApprovalRequest': {
                     const e = event as any;
                     const step_id = e.step_id;
                     for (const t of turns) {
                        const fc = t.function_calls.find(c => c.id === step_id);
                        if (fc) {
                            fc.isWaitingForApproval = true;
                            fc.isRunning = false;
                            break;
                        }
                    }
                    break;
                }
                case 'Failure': {
                    const e = event as Failure;
                    const lastTurn = turns[turns.length - 1];
                    if (lastTurn && lastTurn.role === 'assistant') {
                        lastTurn.isFailure = true;
                        lastTurn.text += `\n\nError: ${e.error}`;
                        lastTurn.isGenerating = false;
                    } else {
                        turns.push({
                            role: 'assistant',
                            text: `Error: ${e.error}`,
                            function_calls: [],
                            step_id: 'failure',
                            isFailure: true,
                            isGenerating: false,
                            disableAnimation: event.isHistorical
                        });
                    }
                    break;
                }
                case 'NaturalStop': {
                    const lastTurn = turns[turns.length - 1];
                    if (lastTurn) {
                        lastTurn.isGenerating = false;
                    }
                    // Track the step_id as completed if available
                    if (lastTurn?.step_id) {
                        completedStepIds.add(lastTurn.step_id);
                    }
                    break;
                }
            }
        });

        // Finalize isGenerating state for historical events
        // For historical events, all turns should have isGenerating: false unless they're waiting for approval
        if (allHistorical) {
            turns.forEach(turn => {
                // Check if turn is waiting for approval - if so, keep it as generating
                const hasWaitingApproval = turn.function_calls.some(fc => fc.isWaitingForApproval);
                if (!hasWaitingApproval) {
                    // All historical turns should be marked as not generating
                    turn.isGenerating = false;
                }
            });
        } else {
            // For mixed historical/realtime events, finalize historical turns only
            turns.forEach(turn => {
                if (turn.disableAnimation) {
                    // This is a historical turn - ensure it's not generating unless waiting for approval
                    const hasWaitingApproval = turn.function_calls.some(fc => fc.isWaitingForApproval);
                    if (!hasWaitingApproval) {
                        // Check if this step is completed
                        const isCompleted = completedStepIds.has(turn.step_id) || 
                                          turn.function_calls.length === 0 ||
                                          turn.function_calls.every(fc => !fc.isRunning);
                        if (isCompleted) {
                            turn.isGenerating = false;
                        }
                    }
                }
            });
        }

        return turns;
    }, [events]);
}
