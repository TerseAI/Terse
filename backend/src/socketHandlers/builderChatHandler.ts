import { Socket } from "socket.io";
import { SendModelRequest } from "../shared/ModelEvents";
import { SocketEvents } from "../shared/SocketEvents";
import WebChatInterface from "../agent/ChatAgent/ChatInterfaces/WebChatInterface";
import ChatAgent from "../agent/ChatAgent/ChatAgent";
import logger from "../logger";

export function registerBuilderChatHandler(
    socket: Socket,
    userId: string,
    organizationId: string,
): void {
    socket.on(SocketEvents.BUILDER_CHAT_MESSAGE, async (payload: { sessionId: string; message: SendModelRequest }) => {
        const { sessionId, message } = payload;
        logger.info(`[builder:chat:message] Received message`, { sessionId, userId, message });

        if (!sessionId) {
            logger.error(`[builder:chat:message] No sessionId provided`);
            return;
        }

        const userMessage = message.user_message;
        const uiState = message.ui_state;
        logger.info(`[builder:chat:message] Processing message`, { sessionId, userId, userMessage, hasUiState: !!uiState });

        const webChatInterface = new WebChatInterface(sessionId, userId, socket, organizationId);
        const chatAgent = new ChatAgent(webChatInterface, sessionId, userId, organizationId, uiState);
        await chatAgent.run(userMessage);
    });
}
