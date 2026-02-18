import { Socket } from "socket.io"

import ChatAgent from "../agent/ChatAgent/ChatAgent"
import WebChatInterface from "../agent/ChatAgent/ChatInterfaces/WebChatInterface"
import { SurveyAnswerTask } from "../agent/ChatAgent/SurveyAnswerTask"
import { surveyAnswerTaskQueue } from "../agent/ChatAgent/SurveyAnswerTaskQueue"
import { buildRunErrorEvent, classifyAgentError } from "../agent/agentErrorUtils"
import { appendBuilderChatErrorContextEvent } from "../agent/contextEvents/runErrorContextEvent"
import logger from "../logger"
import { SendModelRequest } from "../shared/ModelEvents"
import { SocketEvents } from "../shared/SocketEvents"
import { getUserForOrg } from "../utility/workos"

export async function registerBuilderChatHandler(socket: Socket, userId: string, organizationId: string): Promise<void> {
    const user = await getUserForOrg(userId, organizationId)
    if (!user) {
        logger.error("[builder:chat:registerBuilderChatHandler] User not found", { userId, organizationId })
        return
    }

    socket.on(SocketEvents.BUILDER_CHAT_MULTIPLE_CHOICE_ANSWER, async (payload: { sessionId: string; questionId: string; value: string }) => {
        const { sessionId, questionId, value } = payload
        if (!sessionId || !questionId) return

        const answerText = typeof value === "string" ? value : String(value ?? "")
        if (!answerText.trim()) return

        surveyAnswerTaskQueue.emit(new SurveyAnswerTask(questionId, answerText, userId, sessionId))
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
        const chatAgent = new ChatAgent(webChatInterface, sessionId, user, uiState)
        try {
            await chatAgent.run(userMessage)
        } catch (error) {
            const classified = classifyAgentError(error)
            logger.error("[builder:chat:message] Error running ChatAgent", { error, sessionId, userId })
            try {
                await appendBuilderChatErrorContextEvent(sessionId, classified)
            } catch (contextEventError) {
                logger.error("[builder:chat:message] Failed to append raw error context event", { contextEventError, sessionId, userId })
            }
            socket.emit(SocketEvents.BUILDER_CHAT_EVENT, {
                sessionId,
                event: buildRunErrorEvent(classified)
            })
        }
    })
}
