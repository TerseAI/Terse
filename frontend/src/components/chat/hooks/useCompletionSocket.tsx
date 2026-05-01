import { useEffect, useRef, useState } from "react"

import { type ModelEvent, type ModelRequest } from "terse-types"

export type ChatEventPayload = {
    runHistoryModelEvent: ModelEvent
}

export type ChatEventSubscription = (callback: (payload: ChatEventPayload) => void) => () => void

export type UseCompletionSocketOptions = {
    subscribeToEvents?: ChatEventSubscription | null
    sendMessage: (message: ModelRequest) => void
    onEvent: (event: ModelEvent) => void
}

export function useCompletionSocket({ subscribeToEvents, sendMessage, onEvent }: UseCompletionSocketOptions) {
    const onEventRef = useRef(onEvent)
    const [isConnected] = useState(true)

    useEffect(() => {
        onEventRef.current = onEvent
    }, [onEvent])

    useEffect(() => {
        if (!subscribeToEvents) return

        const unsubscribe = subscribeToEvents(payload => {
            const message = payload.runHistoryModelEvent
            switch (message.type) {
                case "TextDelta":
                case "ToolCall":
                case "ToolCallComplete":
                case "NaturalStop":
                case "FilterResult":
                case "Thinking":
                case "ToolApprovalRequest":
                case "ToolApprovalResponse":
                case "Snippet":
                case "ProcessOutput":
                case "UserMessage":
                case "RunError":
                case "Cancelled":
                    onEventRef.current(message)
                    break
                default: {
                    const exhaustiveCheck: never = message
                    console.warn("Unhandled chat event", exhaustiveCheck)
                }
            }
        })

        return () => {
            unsubscribe()
        }
    }, [subscribeToEvents])

    return { sendMessage, isConnected }
}
