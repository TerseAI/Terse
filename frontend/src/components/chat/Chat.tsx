import { useRef } from "react";
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
        const { input, setInput, sendMessage: sendUserMessage } = useChatInput({
            sendMessage,
            onUserMessage
        });

        const messagesEndRef = useRef<HTMLDivElement>(null);
        const lastTurn = externalTurns[externalTurns.length - 1];
        
        // Only show loading if we have an active subscription (run is in progress)
        // and the last turn indicates we're waiting for a response
        const isPendingAssistantResponse = externalTurns.length > 0 && 
            subscribeToEvents != null && 
            (
                lastTurn?.role === 'user' ||
                (lastTurn?.role === 'assistant' && lastTurn?.isGenerating === true)
            );

        return (
            <ChatLayout
                turns={externalTurns}
                isPendingAssistantResponse={isPendingAssistantResponse}
                messagesEndRef={messagesEndRef}
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
