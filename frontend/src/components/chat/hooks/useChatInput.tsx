import { useState } from "react"

import { v4 as uuidv4 } from "uuid"

import { type ModelRequest } from "../../../shared/ModelEvents"

interface UseChatInputOptions {
    sendMessage: (message: ModelRequest) => void
    onUserMessage?: (message: string, clientTurnId: string) => void
}

export function useChatInput({ sendMessage: sendModelRequest, onUserMessage }: UseChatInputOptions) {
    const [input, setInput] = useState("")

    const sendMessage = async (message: string) => {
        setInput("")
        const clientTurnId = `msg_${uuidv4()}`
        onUserMessage?.(message, clientTurnId)

        const modelRequest: ModelRequest = {
            type: "SendModelRequest",
            user_message: message,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            client_turn_id: clientTurnId
        }
        try {
            sendModelRequest(modelRequest)
        } catch (error) {
            console.error("Failed to send message:", error)
        }
    }

    return {
        input,
        setInput,
        sendMessage
    }
}
