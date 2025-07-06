import { ReactNode } from 'react';
import { Turn, TurnView } from './Turn';
import ChatInput from './ChatInput';
import AwaitingResponseAnimation from './AwaitingResponseAnimation';

interface ChatLayoutProps {
    turns: Turn[];
    isPendingAssistantResponse: boolean;
    messagesEndRef: React.RefObject<HTMLDivElement | null>;
    onSendMessage: (message: string) => void;
    input: string;
    setInput: (input: string) => void;
    placeholders?: string[];
    className?: string;
    header?: ReactNode;
    children?: ReactNode;
    customInput?: ReactNode;
}

export function ChatLayout({
    turns,
    isPendingAssistantResponse,
    messagesEndRef,
    onSendMessage,
    input,
    setInput,
    placeholders = ["Type a message..."],
    className = "",
    header,
    children,
    customInput
}: ChatLayoutProps) {
    return (
        <div className={`h-full w-full flex flex-col bg-white ${className}`}>
            {header && (
                <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4">
                    {header}
                </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {turns.map((turn, index) => (
                    <TurnView key={index} {...turn} />
                ))}

                {isPendingAssistantResponse && (
                    <AwaitingResponseAnimation />
                )}
                
                {children}
                
                {/* This is a hack to scroll to the bottom of the messages when a new message is added. */}
                <div ref={messagesEndRef} className="h-1" />
            </div>

            <div className="flex-shrink-0 border-t border-gray-200 bg-white p-4">
                {customInput || (
                    <ChatInput 
                        sendMessage={onSendMessage} 
                        input={input} 
                        setInput={setInput} 
                        placeholders={placeholders} 
                    />
                )}
            </div>
        </div>
    );
} 