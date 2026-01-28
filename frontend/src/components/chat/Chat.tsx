import { forwardRef } from "react";
import { ChatLayout, type ChatLayoutHandle } from "./ChatLayout";
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
    onHandleApprove?: (stepId: string) => void;
    onHandleReject?: (stepId: string) => void;
    addUserTurnsLocally?: boolean;
    inputSize?: 'small' | 'medium' | 'large';
    placeholders?: string[];
    showPlaceholderChips?: boolean;
};

export type ChatHandle = ChatLayoutHandle;

const Chat = forwardRef<ChatHandle, ChatProps>(function Chat({
    initialTurns,
    EmptyContentPlaceholder,
    subscribeToEvents,
    sendMessage,
    onUserMessage,
    onHandleApprove,
    onHandleReject,
    addUserTurnsLocally,
    inputSize = 'small',
    placeholders = ["Chat with the AI assistant"],
    showPlaceholderChips = false,
}, ref) {
    const { turns, isPendingAssistantResponse, input, setInput, sendMessage: sendUserMessage, sendModelRequest } = useChat({
        subscribeToEvents,
        sendMessage,
        initialTurns,
        onUserMessage,
        onToolCall: () => {},
        onToolCallComplete: () => {},
        addUserTurnsLocally,
    });

    return (
        <ChatLayout
            ref={ref}
            turns={turns}
            isPendingAssistantResponse={isPendingAssistantResponse}
            onSendMessage={sendUserMessage}
            onSendModelRequest={sendModelRequest}
            input={input}
            setInput={setInput}
            placeholders={placeholders}
            EmptyContentPlaceholder={EmptyContentPlaceholder}
            onApprove={onHandleApprove}
            onReject={onHandleReject}
            inputSize={inputSize}
            showPlaceholderChips={showPlaceholderChips}
        />
    );
});

export { Chat }
