import { ChatLayout } from "./ChatLayout";
import { useChat } from "./hooks/useChat";
import { Turn } from "./Turn";
import { type ChatEventSubscription } from "./hooks/useCompletionSocket";
import { type ModelRequest } from "../../shared/ModelEvents";

type ChatProps = {
    initialTurns?: Turn[];
    EmptyContentPlaceholder?: React.ReactNode;
    subscribeToEvents?: ChatEventSubscription | null;
    sendMessage: (message: ModelRequest) => void;
    onUserMessage?: (message: string) => void;
    initialScrollToBottom?: boolean;
};

function Chat({ 
    initialTurns,
    EmptyContentPlaceholder,  
    subscribeToEvents,
    sendMessage,
    onUserMessage
}: ChatProps) {
    const { turns, isPendingAssistantResponse, messagesEndRef, input, setInput, sendMessage: sendUserMessage, sendModelRequest } = useChat({
        subscribeToEvents,
        sendMessage,
        initialTurns,
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
