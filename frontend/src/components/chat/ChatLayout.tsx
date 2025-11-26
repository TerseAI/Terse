import { AwaitingResponseAnimation } from './AwaitingResponseAnimation';
import { type Turn, TurnView } from './Turn';
import ChatInput from './ChatInput';
import { type ModelRequest } from '../../shared/ModelEvents';

interface ChatLayoutProps {
    turns: Turn[];
    isPendingAssistantResponse: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
    onSendMessage: (message: string) => void;
    onSendModelRequest?: (request: ModelRequest) => void;
    input: string;
    setInput: (input: string) => void;
    placeholders?: string[];
    EmptyContentPlaceholder?: React.ReactNode;
}

export function ChatLayout({
    turns,
    isPendingAssistantResponse,
    messagesEndRef,
    scrollContainerRef,
    onSendMessage,
    input,
    setInput,
    placeholders = ["Type a message..."],
    EmptyContentPlaceholder,
}: ChatLayoutProps) {
    return (
        <div className={`h-full w-full backdrop-blur-sm shadow-lg transition-opacity duration-300 opacity-100 rounded-lg flex flex-col`}>
            <div ref={scrollContainerRef as React.RefObject<HTMLDivElement>} className="flex-1 overflow-y-auto p-4 space-y-1">
                {turns.map((turn, index) => (
                    <TurnView key={index} {...turn} />
                ))}

                {isPendingAssistantResponse && (
                    <AwaitingResponseAnimation />
                )}

                {turns.length === 0 && (
                    EmptyContentPlaceholder
                )}
                
                
                {/* This is a hack to scroll to the bottom of the messages when a new message is added. */}
                <div ref={messagesEndRef} className="h-1" />
            </div>

            <div className="flex-shrink-0">
                <ChatInput 
                    sendMessage={onSendMessage} 
                    input={input} 
                    setInput={setInput} 
                    placeholders={placeholders} 
                />
            </div>
        </div>
    );
} 
 
