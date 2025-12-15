import { forwardRef, useCallback } from "react";
import { ChatLayout, type ChatLayoutHandle } from "./ChatLayout";
import { useChat } from "./hooks/useChat";
import { Turn } from "./Turn";
import { type ChatEventSubscription } from "./hooks/useCompletionSocket";
import { type ModelRequest } from "../../shared/ModelEvents";
import { sendToolApprovalResponse } from "../../socket";

type ChatProps = {
    initialTurns?: Turn[];
    EmptyContentPlaceholder?: React.ReactNode;
    subscribeToEvents?: ChatEventSubscription | null;
    sendMessage: (message: ModelRequest) => void;
    onUserMessage?: (message: string) => void;
    runId?: string | null;
};

export type ChatHandle = ChatLayoutHandle;

const Chat = forwardRef<ChatHandle, ChatProps>(function Chat({ 
    initialTurns,
    EmptyContentPlaceholder,  
    subscribeToEvents,
    sendMessage,
    onUserMessage,
    runId
}, ref) {
    const { turns, isPendingAssistantResponse, input, setInput, sendMessage: sendUserMessage, sendModelRequest, handleToolApprovalResponse } = useChat({
        subscribeToEvents,
        sendMessage,
        initialTurns,
        onUserMessage,
        onToolCall: () => {},
        onToolCallComplete: () => {},
    });

    const handleApprove = useCallback((stepId: string) => {
        if (!runId) {
            console.error('No runId available for approval');
            return;
        }
        sendToolApprovalResponse(runId, stepId, true);
        // Optimistically update UI
        handleToolApprovalResponse({ step_id: stepId, approved: true });
    }, [runId, handleToolApprovalResponse]);

    const handleReject = useCallback((stepId: string) => {
        if (!runId) {
            console.error('No runId available for rejection');
            return;
        }
        sendToolApprovalResponse(runId, stepId, false);
        // Optimistically update UI
        handleToolApprovalResponse({ step_id: stepId, approved: false });
    }, [runId, handleToolApprovalResponse]);

    return (
        <ChatLayout
            ref={ref}
            turns={turns}
            isPendingAssistantResponse={isPendingAssistantResponse}
            onSendMessage={sendUserMessage}
            onSendModelRequest={sendModelRequest}
            input={input}
            setInput={setInput}
            placeholders={["Chat with the AI assistant"]}
            EmptyContentPlaceholder={EmptyContentPlaceholder}
            onApprove={handleApprove}
            onReject={handleReject}
        />
    );
});

export { Chat }
