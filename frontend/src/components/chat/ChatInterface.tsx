import { useState, useRef, useEffect, useCallback } from 'react';
import { ConnectionType } from './useCompletionSocket';
import { ItemToDisplay, Turn } from './Turn';
import { Types } from '../../utility/Types';
import AwaitingResponseAnimation from './AwaitingResponseAnimation';
import { clientBoundTools, ShowTypeToUserParameters } from '../../shared/ClientBoundTools';
import { SnippetNavigationProvider } from '../../context/SnippetNavigationContext';
import { EntityType } from '../../shared/Entities';
import { ChangedItem } from '../../shared/ModelEvents';
import { ChatLayout } from './ChatLayout';
import { ChatProvider } from './ChatProvider';
import { TurnView } from './Turn';

interface ChatInterfaceContentProps {
    onSnippetSelect: (handler: (snippet: any) => void) => void;
}

function ChatInterfaceContent({ onSnippetSelect }: ChatInterfaceContentProps) {
    const suggestionsList = suggestions;

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

    // Connection status indicator
    const getConnectionStatus = () => {
        // This will be handled by ChatProvider
        return (
            <div className="relative">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75"></div>
            </div>
        );
    };

    // Header component for ChatLayout
    const header = (
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
    );

    return (
        <div className="h-screen bg-[rgb(8,9,10)]/90 transition-[width] transition-all duration-300 ease-in-out backdrop-blur-sm ${className || ''} relative">
                <ChatProvider
                    connectionType={ConnectionType.MainChat}
                    onToolCall={(req, addCustomSnippet) => {
                        if (clientBoundTools.find(tool => tool.id === req.summary)) {
                            const { items } = clientBoundTools.find(tool => tool.id === req.summary)?.parseParameters(req.parameters) as ShowTypeToUserParameters;
                            let item: ItemToDisplay[] = formatChangedItems(items.map(item => ({ type_name: item.type as EntityType, id: item.id })));
                            addCustomSnippet(req.step_id, <TurnView role="assistant" text="" function_calls={[]} items={item} step_id={req.step_id} />);
                            return;
                        }
                    }}
                >
                    {({ turns, isPendingAssistantResponse, messagesEndRef, input, setInput, sendMessage, customInput }) => {
                        const isChatEmpty = turns.length === 0;

                        // Empty state content
                        const emptyStateContent = isChatEmpty ? (
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
                        ) : null;

                        return (
                            <ChatLayout
                                turns={turns}
                                isPendingAssistantResponse={isPendingAssistantResponse}
                                messagesEndRef={messagesEndRef}
                                onSendMessage={sendMessage}
                                input={input}
                                setInput={setInput}
                                placeholders={["Type what you want to do..."]}
                                className=""
                                header={header}
                                customInput={customInput}
                            >
                                {emptyStateContent}
                                {isPendingAssistantResponse && <AwaitingResponseAnimation />}
                            </ChatLayout>
                        );
                    }}
                </ChatProvider>
        </div>
    );
}

export function ChatInterface() {
    const snippetSelectHandlerRef = useRef<((snippet: any) => void) | null>(null);

    return (
        <SnippetNavigationProvider onSnippetSelect={(snippet) => {
            snippetSelectHandlerRef.current?.(snippet);
        }}>
            <ChatInterfaceContent
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