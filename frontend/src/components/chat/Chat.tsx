import { useRef, useEffect } from "react";
import { ChatLayout } from "./ChatLayout";
import { useChat } from "./hooks/useChat";
import { Turn } from "./Turn";
import { useChatInput } from "./hooks/useChatInput";
import { type ChatEventSubscription } from "./hooks/useCompletionSocket";
import { type ModelRequest } from "../../shared/ModelEvents";

type ChatProps = {
    initialMessage?: string;
    EmptyContentPlaceholder?: React.ReactNode;
    turns?: Turn[];
    subscribeToEvents?: ChatEventSubscription | null;
    sendMessage: (message: ModelRequest) => void;
    onUserMessage?: (message: string) => void;
};

function Chat({ 
    initialMessage, 
    EmptyContentPlaceholder, 
    turns: externalTurns, 
    subscribeToEvents,
    sendMessage,
    onUserMessage 
}: ChatProps) {
    if (externalTurns) {
        // "Controlled" / History Mode
        const { input, setInput, sendMessage: sendUserMessage } = useChatInput({
            sendMessage,
            onUserMessage
        });

        const messagesEndRef = useRef<HTMLDivElement>(null);
        const scrollContainerRef = useRef<HTMLDivElement>(null);

        // Scroll to bottom when turns are loaded or change
        useEffect(() => {
            if (externalTurns.length > 0 && scrollContainerRef.current) {
                // Use requestAnimationFrame to ensure DOM is fully rendered
                requestAnimationFrame(() => {
                    if (scrollContainerRef.current) {
                        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
                    }
                });
            }
        }, [externalTurns.length]);

        return (
            <ChatLayout
                turns={externalTurns}
                isPendingAssistantResponse={false}
                messagesEndRef={messagesEndRef}
                scrollContainerRef={scrollContainerRef}
                onSendMessage={sendUserMessage}
                onSendModelRequest={() => {}}
                input={input}
                setInput={setInput}
                placeholders={["Type a message..."]}
                EmptyContentPlaceholder={EmptyContentPlaceholder}
            />
        );
    }

    // "Uncontrolled" / Main Chat Mode
    const { turns, isPendingAssistantResponse, messagesEndRef, input, setInput, sendMessage: sendUserMessage, sendModelRequest } = useChat({
        subscribeToEvents,
        sendMessage,
        initialMessage,
        onUserMessage,
        onToolCall: () => {},
        onToolCallComplete: () => {},
    });

    return (
        <ChatLayout
            turns={turns}
            isPendingAssistantResponse={isPendingAssistantResponse}
            messagesEndRef={messagesEndRef}
            onSendMessage={sendUserMessage}
            onSendModelRequest={sendModelRequest}
            input={input}
            setInput={setInput}
            placeholders={["Test out your use case!"]}
            EmptyContentPlaceholder={EmptyContentPlaceholder}
        />
    );
}

export { Chat }
