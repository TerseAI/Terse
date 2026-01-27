import { db } from "../../prismaClient";
import WebChatInterface from "./ChatInterfaces/WebChatInterface";
import ChatAgent from "./ChatAgent";
import logger from "../../logger";
import { IntegrationType } from "../../shared/Integrations";
import { getRealtimeSocket } from "../../realtimeSocket";
import { SocketRooms } from "../../shared/SocketEvents";
import { Socket } from "socket.io";

export async function resumeChatAgentAfterFormCompletionWeb(
    userId: string,
    chatId: string,
    integrationType: IntegrationType,
    integrationId: string
): Promise<void> {
    try {
        const io = getRealtimeSocket();
        if (!io) {
            logger.error('Cannot resume ChatAgent: Socket.IO server not initialized', { userId, chatId });
            return;
        }

        // Find a socket for this user
        const userRoom = SocketRooms.user(userId);
        const room = io.sockets.adapter.rooms.get(userRoom);
        
        if (!room || room.size === 0) {
            logger.warn('Cannot resume ChatAgent: User not connected via socket', { userId, chatId });
            return;
        }

        // Get the first socket in the room
        const socketId = Array.from(room)[0];
        const socket = io.sockets.sockets.get(socketId) as Socket | undefined;

        if (!socket) {
            logger.error('Cannot resume ChatAgent: Socket not found', { userId, chatId, socketId });
            return;
        }

        const webChatInterface = new WebChatInterface(chatId, userId, socket);
        const chatAgent = new ChatAgent(webChatInterface, chatId, userId);

        const integrationName = formatIntegrationName(integrationType);

        const message = `The ${integrationName} integration has been successfully connected. Integration ID: ${integrationId}. You may Proceed!`;
        await chatAgent.run(message);

        logger.info('ChatAgent resumed after form completion (web)', { userId, chatId, integrationType, integrationId });
    } catch (error) {
        logger.error('Error resuming ChatAgent after form completion (web)', { error, userId, chatId, integrationType, integrationId });
        // Don't throw - we don't want to break the form completion flow
    }
}

function formatIntegrationName(integrationType: IntegrationType): string {
    return integrationType
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase());
}
