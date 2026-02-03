import { type ModelRequest, type ToolCall, type ToolCallComplete } from "../../../shared/ModelEvents"
import { Turn } from "../Turn"

import { useChatInput } from "./useChatInput"
import { useChatTurns } from "./useChatTurns"
import { type ChatEventSubscription, useCompletionSocket } from "./useCompletionSocket"

interface UseChatOptions {
    subscribeToEvents?: ChatEventSubscription | null
    sendMessage: (message: ModelRequest) => void
    initialTurns?: Turn[]
    onUserMessage?: (message: string) => void
    onToolCall?: (req: ToolCall) => void
    onToolCallComplete?: (req: ToolCallComplete) => void
    addUserTurnsLocally?: boolean
}

export function useChat({ subscribeToEvents, sendMessage: sendModelRequest, initialTurns, onUserMessage, onToolCall, onToolCallComplete, addUserTurnsLocally = false }: UseChatOptions) {
    const {
        turns,
        isPendingAssistantResponse,
        handleDelta,
        handleToolCallGenerating,
        handleToolCall,
        handleToolCallComplete,
        handleFailure,
        handleNaturalStop,
        handleFilterResult,
        handleThinking,
        handleToolApprovalRequest,
        handleToolApprovalResponse,
        addUserTurn,
        handleSnippet
    } = useChatTurns({ initialTurns })

    const { sendMessage: sendSocketMessage } = useCompletionSocket({
        subscribeToEvents,
        sendMessage: sendModelRequest,
        onDelta: handleDelta,
        onToolCallGenerating: handleToolCallGenerating,
        onToolCall: (req: ToolCall) => {
            handleToolCall(req)
            onToolCall?.(req)
        },
        onToolCallComplete: (req: ToolCallComplete) => {
            handleToolCallComplete(req)
            onToolCallComplete?.(req)
        },
        onFailure: handleFailure,
        onNaturalStop: handleNaturalStop,
        onFilterResult: handleFilterResult,
        onThinking: handleThinking,
        onToolApprovalRequest: handleToolApprovalRequest,
        onToolApprovalResponse: handleToolApprovalResponse,
        onSnippet: handleSnippet
    })

    const { input, setInput, sendMessage } = useChatInput({
        sendMessage: sendSocketMessage,
        onUserMessage: (message: string) => {
            if (addUserTurnsLocally) {
                addUserTurn(message)
            }
            onUserMessage?.(message)
        }
    })

    return {
        turns,
        isPendingAssistantResponse,
        input,
        setInput,
        sendMessage,
        sendModelRequest: sendSocketMessage,
        handleToolApprovalResponse
    }
}
