import { Socket } from "socket.io"

import ChatAgent from "../agent/ChatAgent/ChatAgent"
import WebChatInterface from "../agent/ChatAgent/ChatInterfaces/WebChatInterface"
import logger from "../logger"
import { SendModelRequest } from "../shared/ModelEvents"
import { SocketEvents } from "../shared/SocketEvents"

export function registerBuilderChatHandler(socket: Socket, userId: string, organizationId: string): void {
    socket.on(SocketEvents.BUILDER_CHAT_MULTIPLE_CHOICE_ANSWER, async (payload: { sessionId: string; questionId: string; value: string }) => {
        const { sessionId, questionId, value } = payload
        if (!sessionId || questionId === undefined) return

        try {
            const syntheticMessage = `The user answered the survey question (id: ${questionId}) with: ${value}`
            const webChatInterface = new WebChatInterface(sessionId, userId, socket, organizationId)
            const chatAgent = new ChatAgent(webChatInterface, sessionId, userId, organizationId)
            await chatAgent.run(syntheticMessage)
        } catch (error) {
            logger.error("Error resuming ChatAgent after survey answer", { error, sessionId, questionId, userId })
        }
    })

    socket.on(SocketEvents.BUILDER_CHAT_MESSAGE, async (payload: { sessionId: string; message: SendModelRequest }) => {
        const { sessionId, message } = payload
        logger.info(`[builder:chat:message] Received message`, { sessionId, userId, message })

        if (!sessionId) {
            logger.error(`[builder:chat:message] No sessionId provided`)
            return
        }

        const userMessage = message.user_message
        const uiState = message.ui_state
        const timezone = message.timezone
        logger.info(`[builder:chat:message] Processing message`, { sessionId, userId, userMessage, hasUiState: !!uiState, timezone })

        const webChatInterface = new WebChatInterface(sessionId, userId, socket, organizationId, timezone)
        const chatAgent = new ChatAgent(webChatInterface, sessionId, userId, organizationId, uiState)
        await chatAgent.run(userMessage)
    })
}
