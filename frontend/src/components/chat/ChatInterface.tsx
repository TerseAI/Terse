import { useState, useRef, useEffect, useCallback } from 'react';
import { ConnectionType, useCompletionSocket } from './useCompletionSocket';
import { ItemToDisplay, Turn, TurnView } from './Turn';
import { Types } from '../../utility/Types';
import ChatInput from './ChatInput';
import AwaitingResponseAnimation from './AwaitingResponseAnimation';
import { clientBoundTools, ShowTypeToUserParameters } from '../../shared/ClientBoundTools';
import { SnippetNavigationProvider } from '../../context/SnippetNavigationContext';
import { EntityType } from '../../shared/Entities';
import { ChangedItem } from '../../shared/ModelEvents';

interface ChatInterfaceProps {
    className?: string;
}

interface ChatInterfaceContentProps extends ChatInterfaceProps {
    onSnippetSelect: (handler: (snippet: any) => void) => void;
}

function ChatInterfaceContent({ className, onSnippetSelect }: ChatInterfaceContentProps) {
    const chatRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState('');
    const [turns, setTurns] = useState<Turn[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const stepBuffersRef = useRef<Map<string, string>>(new Map());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);
    const [chatWidth, setChatWidth] = useState(400); // Default width in pixels
    const minWidth = 300; // Minimum width in pixels
    const maxWidth = 800; // Maximum width in pixels

    // Check if last turn is user. If so, we are waiting for an assistant response.
    const isPendingAssistantResponse = isGenerating;
    const isChatEmpty = turns.length === 0;

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [turns]);

    // Clear snippets when turns change significantly (new conversation)
    useEffect(() => {
        // This will be called when the navigation context is available
        // We'll handle this in the snippet selection handler registration
    }, [turns.length]);

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;

            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                setChatWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    const suggestionsList = suggestions;

    const handleDelta = ({ delta, step_id }: { delta: string; step_id: string }) => {
        // Merge delta into buffer
        const existing = stepBuffersRef.current.get(step_id) ?? '';
        const newText = existing + delta;
        stepBuffersRef.current.set(step_id, newText);

        updateOrCreateTurn(step_id, { text: newText });
    }

    const handleToolCall = ({ summary, step_id, parameters }: { summary: string; step_id: string; parameters: string }) => {
        if (clientBoundTools.find(tool => tool.id === summary)) {
            const { items } = clientBoundTools.find(tool => tool.id === summary)?.parseParameters(parameters) as ShowTypeToUserParameters;
            let item: ItemToDisplay[] = formatChangedItems(items.map(item => ({ type_name: item.type as EntityType, id: item.id })));
            updateOrCreateTurn(step_id, { items: item });
            return;
        }

        updateOrCreateTurn(step_id, {
            function_calls: [{ id: step_id, name: summary, isRunning: true }]
        });
    }

    const handleToolApprovalRequest = ({ step_id, name, arguments: args }: { step_id: string; name: string; arguments: string }) => {
        console.log("Tool approval request", step_id, name, args);
    }

    const handleToolCallComplete = async ({
        status,
        step_id,
        changed_items,
    }: {
        status: string;
        step_id: string;
        changed_items: ChangedItem[];
    }) => {
        // TODO: We need to figure out how to know when the model is mutating.
        // The issue is lifecycle of the component. We trigger mutate, it fires of the work and completes.
        // But when the new data is returned, we've already marked the model as no longer mutating.
        // If we were to set this later (like at stream end), it would mark user changes as model mutating when they are not.
        // May need some fancy wrapper. Moving this to not urgent for now. But we should track.
        console.log("Tool call complete", status, step_id, changed_items);

        setTurns((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (!last || last.step_id !== step_id) {
                return updated;
            }
            updated[updated.length - 1].function_calls = updated[updated.length - 1].function_calls.map((call) =>
                call.id === step_id ? { ...call, isRunning: false } : call
            );
            // updated[updated.length - 1].items = formatChangedItems(changed_items);
            return updated;
        });
    };

    const handleFailure = ({ error }: { error: string }) => {
        console.log("Failure", error);
        setIsGenerating(false);
        setTurns(prev => {
            let failure: Turn = {
                role: 'assistant', text: "Something went wrong. Please try again. " + error, function_calls: [], step_id: '',
                isFailure: true
            };
            return [...prev, failure];
        });
    };

    const handleNaturalStop = () => {
        setIsGenerating(false);
        setTurns(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last) {
                last.isGenerating = false;
            }
            return updated;
        });
    }

    const connection = useCompletionSocket({ connectionType: ConnectionType.MainChat, onDelta: handleDelta, onToolCall: handleToolCall, onToolCallComplete: handleToolCallComplete, onToolApprovalRequest: handleToolApprovalRequest, onFailure: handleFailure, onNaturalStop: handleNaturalStop });

    // Add connection status indicator
    const getConnectionStatus = () => {
        if (!connection.isConnected) {
            return <div className="text-red-400 text-xs opacity-70">● Disconnected</div>;
        }
        return (
            <div className="relative">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
            </div>
        );
    };

    async function sendMessage(message: string) {
        setInput('');
        setIsGenerating(true);
        console.log("Sending message", message);
        const userTurn: Turn = { role: 'user', text: message, function_calls: [], step_id: 'user_turn' };
        setTurns(prev => [...prev, userTurn]);
        connection.connection?.sendMessage({ type: 'SendModelRequest', user_message: message, visible_actors: [], timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    }

    // Helper to update or create a turn.
    const updateOrCreateTurn = (step_id: string, updates: Partial<Turn>) => {
        setTurns(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];

            if (!last || last.step_id !== step_id) {
                return [...updated, {
                    role: 'assistant',
                    text: "",
                    function_calls: [],
                    isGenerating: true,
                    step_id,
                    ...updates
                }];
            }

            // Merge updates with existing turn
            Object.assign(last, updates);
            return updated;
        });
    }

    // Handle snippet selection
    const handleSnippetSelect = useCallback(async (snippet: any) => {
        switch (snippet.type.backendRepresentation) {
            case 'ticket':
                //openOverlay([snippet.id]);
                break;
            case 'user':
                // Maybe navigate to user view or show user's tickets
                console.log('Opening user:', snippet.id);
                break;
            case 'component':
                // Maybe navigate to component view
                console.log('Opening component:', snippet.id);
                break;
            case 'ticket_status':
            case 'ticket_priority':
                // Maybe show edit modal or navigate to settings
                console.log('Opening status/priority:', snippet.id);
                break;
            case 'comment':
                // get ticket id from comment
                break;
            default:
                console.log('Unknown snippet type:', snippet.type.backendRepresentation);
        }
    }, []);

    // Register the snippet selection handler
    useEffect(() => {
        onSnippetSelect(handleSnippetSelect);
    }, [handleSnippetSelect, onSnippetSelect]);

    return (
        <div
            ref={chatRef}
            className={`h-screen bg-[rgb(8,9,10)]/90 transition-[width] transition-all duration-300 ease-in-out backdrop-blur-sm ${true ? 'shadow-lg' : 'w-12'} ${className || ''} relative`}
            style={{ width: true ? `${chatWidth}px` : '48px' }}
        >

            <div
                className={`absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/50 transition-colors z-50 ${isResizing ? 'bg-blue-500' : ''}`}
                onMouseDown={handleMouseDown}
            />

            <div
                className={`h-full w-full bg-[rgb(8, 9, 10)]/50 backdrop-blur-sm shadow-lg transition-opacity duration-300 ${true ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <div className="grid grid-rows-[auto_1fr_auto] h-full">
                    <div className="p-4">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <h2 className="font-semibold text-white">Chat</h2>
                                <div className="flex items-center">
                                    {getConnectionStatus()}
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 pr-8">
                                Use ↑↓ to navigate snippets
                            </div>
                        </div>
                    </div>

                    <div className="overflow-y-auto p-4 space-y-1">
                        {isChatEmpty && (
                            <div className="grid grid-rows-1 h-full place-items-center justify-center animate-slide-in animate-fade-in">
                                <div className="grid grid-rows-1 place-items-center justify-center gap-2">
                                    <div className="text-[#F1F1F1] space-y-4 max-w-lg text-center">
                                        <h3 className="text-xl font-semibold mb-4">You can ask me to do anything</h3>
                                        <div className="text-[#F1F1F1]/60 space-y-2 text-left bg-white/10 rounded-lg p-4 shadow-lg">
                                            {suggestionsList.map((suggestion, index) => (
                                                <p key={index} className="cursor-pointer hover:text-[#F1F1F1]/80" onClick={() => sendMessage(suggestion)}>"{suggestion}"</p>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {turns.map((turn, index) => (
                            <TurnView key={index} {...turn} turnIndex={index} />
                        ))}

                        {isPendingAssistantResponse && (
                            <AwaitingResponseAnimation />
                        )}

                        {/* This is a hack to scroll to the bottom of the messages when a new message is added. */}
                        <div ref={messagesEndRef} className="h-1" />
                    </div>

                    <ChatInput sendMessage={sendMessage} input={input} setInput={setInput} placeholders={["Type what you want to do..."]} />
                </div>
            </div>
        </div>
    );
}

export function ChatInterface({ className }: ChatInterfaceProps) {
    const snippetSelectHandlerRef = useRef<((snippet: any) => void) | null>(null);

    return (
        <SnippetNavigationProvider onSnippetSelect={(snippet) => {
            snippetSelectHandlerRef.current?.(snippet);
        }}>
            <ChatInterfaceContent
                className={className}
                onSnippetSelect={(handler) => {
                    snippetSelectHandlerRef.current = handler;
                }}
            />
        </SnippetNavigationProvider>
    );
}

// Mark: Helper

function formatChangedItems(changed_items: ChangedItem[]): ItemToDisplay[] {
    return changed_items
        .map(item => {
            const type = Types.find(type => type.backendRepresentation === item.type_name);
            if (!type) return null;
            return {
                type,
                id: parseInt(item.id)
            };
        })
        .filter((item): item is ItemToDisplay => item !== null);
}

const suggestions = [
    "Create a new ticket",
    "Mark my ticket as done",
    "What are my open tickets that are due soon?",
    "What has my team been working on?",
    "Create release notes using the tickets I completed this week"
]