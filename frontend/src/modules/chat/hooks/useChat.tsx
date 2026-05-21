import { type ModelEvent, type ModelRequest, type ToolApprovalResponse, type ToolCall, type ToolCallComplete } from "terse-types"

import type { Turn } from "../turnModel"

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
    onMultipleChoiceAnswer?: (questionId: string, value: string) => void
    addUserTurnsLocally?: boolean
}

export function useChat({
    subscribeToEvents,
    sendMessage: sendModelRequest,
    initialTurns,
    onUserMessage,
    onToolCall,
    onToolCallComplete,
    onMultipleChoiceAnswer,
    addUserTurnsLocally = false
}: UseChatOptions) {
    const { turns, isPendingAssistantResponse, onEvent, addUserTurn, handleMultipleChoiceAnswered } = useChatTurns({ initialTurns })

    const { sendMessage: sendSocketMessage } = useCompletionSocket({
        subscribeToEvents,
        sendMessage: sendModelRequest,
        onEvent: (event: ModelEvent) => {
            onEvent(event)
            if (event.type === "ToolCall") {
                onToolCall?.(event)
            }
            if (event.type === "ToolCallComplete") {
                onToolCallComplete?.(event)
            }
        }
    })

    const { input, setInput, sendMessage } = useChatInput({
        sendMessage: sendSocketMessage,
        onUserMessage: (message: string, clientTurnId: string) => {
            if (addUserTurnsLocally) {
                addUserTurn(message, clientTurnId)
            }
            onUserMessage?.(message)
        }
    })

    const handleMultipleChoiceAnswer = (questionId: string, value: string) => {
        handleMultipleChoiceAnswered(questionId, value)
        onMultipleChoiceAnswer?.(questionId, value)
    }

    return {
        turns,
        isPendingAssistantResponse,
        input,
        setInput,
        sendMessage,
        sendModelRequest: sendSocketMessage,
        handleToolApprovalResponse: (response: ToolApprovalResponse) => onEvent(response),
        handleMultipleChoiceAnswer
    }
}
