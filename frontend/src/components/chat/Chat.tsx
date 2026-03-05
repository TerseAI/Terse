import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

import { type ModelRequest } from "../../shared/ModelEvents"

import { ChatLayout, type ChatLayoutHandle } from "./ChatLayout"
import { Turn } from "./Turn"
import { useChat } from "./hooks/useChat"
import { type ChatEventSubscription } from "./hooks/useCompletionSocket"

type ChatProps = {
    initialTurns?: Turn[]
    EmptyContentPlaceholder?: React.ReactNode
    subscribeToEvents?: ChatEventSubscription | null
    sendMessage: (message: ModelRequest) => void
    onUserMessage?: (message: string) => void
    onHandleApprove?: (stepId: string) => void
    onHandleReject?: (stepId: string) => void
    onHandleCancellation?: () => void
    onMultipleChoiceAnswer?: (questionId: string, value: string) => void
    addUserTurnsLocally?: boolean
    inputSize?: "small" | "medium" | "large"
    placeholders?: string[]
    showPlaceholderChips?: boolean
}

export type ChatHandle = ChatLayoutHandle & {
    setInput: (value: string) => void
    focus: () => void
}

const Chat = forwardRef<ChatHandle, ChatProps>(function Chat(
    {
        initialTurns,
        EmptyContentPlaceholder,
        subscribeToEvents,
        sendMessage,
        onUserMessage,
        onHandleApprove,
        onHandleReject,
        onHandleCancellation,
        onMultipleChoiceAnswer,
        addUserTurnsLocally,
        inputSize = "small",
        placeholders = [],
        showPlaceholderChips = false
    },
    ref
) {
    const chatLayoutRef = useRef<ChatLayoutHandle>(null)
    const hasScrolledToBottomRef = useRef(false)
    const {
        turns,
        isPendingAssistantResponse,
        input,
        setInput,
        sendMessage: sendUserMessage,
        sendModelRequest,
        handleMultipleChoiceAnswer
    } = useChat({
        subscribeToEvents,
        sendMessage,
        initialTurns,
        onUserMessage,
        onToolCall: () => {},
        onToolCallComplete: () => {},
        onMultipleChoiceAnswer,
        addUserTurnsLocally
    })
    // Scroll to bottom when initialTurns are first rendered
    useEffect(() => {
        if (initialTurns && initialTurns.length > 0 && !hasScrolledToBottomRef.current) {
            hasScrolledToBottomRef.current = true
            requestAnimationFrame(() => {
                chatLayoutRef.current?.scrollToBottom()
            })
        }
    }, [initialTurns])

    // Expose both ChatLayout methods and setInput to parent
    useImperativeHandle(ref, () => ({
        scrollToBottom: () => chatLayoutRef.current?.scrollToBottom(),
        focus: () => chatLayoutRef.current?.focus(),
        setInput
    }))

    return (
        <ChatLayout
            ref={chatLayoutRef}
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
            onCancel={onHandleCancellation}
            onMultipleChoiceAnswer={handleMultipleChoiceAnswer}
            inputSize={inputSize}
            showPlaceholderChips={showPlaceholderChips}
        />
    )
})

export { Chat }
