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
                    turn.isGenerating = true;
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
                            isRunning: true,
                            parameters: e.parameters,
                            isWaitingForUserInput: true
                        });
                    } else {
                        existingCall.parameters = e.parameters;
                    }
                    turn.isGenerating = true;
                    break;
                }
                case 'ToolCallComplete': {
                    const e = event as ToolCallComplete;
                    const step_id = e.step_id;
                    // Find the call in any turn
                    for (const t of turns) {
                        const fc = t.function_calls.find(c => c.id === step_id);
                        if (fc) {
                            fc.isRunning = false;
                            fc.result = e.result;
                            fc.isWaitingForUserInput = false;
                            break;
                        }
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
                    break;
                }
            }
        });

        return turns;
    }, [events]);
}
