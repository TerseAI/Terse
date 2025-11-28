import { useCompletionSocket, type ChatEventSubscription } from './useCompletionSocket';
import { useChatTurns } from './useChatTurns';
import { useChatInput } from './useChatInput';
import { useInitialMessage } from './useInitialMessage';
import { type ModelRequest, type ToolCallComplete, type ToolCall } from '../../../shared/ModelEvents';

interface UseChatOptions {
    subscribeToEvents?: ChatEventSubscription | null;
    sendMessage: (message: ModelRequest) => void;
    initialMessage?: string;
    onUserMessage?: (message: string) => void;
    onToolCall?: (req: ToolCall) => void;
    onToolCallComplete?: (req: ToolCallComplete) => void;
}

export function useChat({
    subscribeToEvents,
    sendMessage: sendModelRequest,
    initialMessage,
    onUserMessage,
    onToolCall,
    onToolCallComplete,
}: UseChatOptions) {
    const {
        turns,
        isPendingAssistantResponse,
        messagesEndRef,
        handleDelta,
        handleToolCall,
        handleToolCallComplete,
        handleFailure,
        handleNaturalStop,
        addUserTurn,
    } = useChatTurns();

    const { sendMessage: sendSocketMessage, isConnected } = useCompletionSocket({
        subscribeToEvents,
        sendMessage: sendModelRequest,
        onDelta: handleDelta,
        onToolCall: (req: ToolCall) => {
            handleToolCall(req);
            onToolCall?.(req);
        },
        onToolCallComplete: (req: ToolCallComplete) => {
            handleToolCallComplete(req);
            onToolCallComplete?.(req);
        },
        onFailure: handleFailure,
        onNaturalStop: handleNaturalStop,
    });

    const { input, setInput, sendMessage } = useChatInput({
        sendMessage: sendSocketMessage,
        onUserMessage: (message: string) => {
            addUserTurn(message);
            onUserMessage?.(message);
        }
    });

    // Send initial message if provided
    useInitialMessage({
        sendMessage: sendSocketMessage,
        message: { type: "SendModelRequest", user_message: initialMessage || "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        enabled: !!initialMessage && turns.length === 0,
        isConnected
    });

    return {
        turns,
        isPendingAssistantResponse,
        messagesEndRef,
        input,
        setInput,
        sendMessage,
        sendModelRequest: sendSocketMessage,
    };
}
