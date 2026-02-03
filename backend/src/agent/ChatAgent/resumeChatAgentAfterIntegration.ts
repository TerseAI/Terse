import { Socket } from "socket.io"

import { initializeSlackWebClient } from "../../integrations/SlackClient"
import logger from "../../logger"
import { db } from "../../prismaClient"
import { getRealtimeSocket } from "../../realtimeSocket"
import { IntegrationType } from "../../shared/Integrations"
import { SocketRooms } from "../../shared/SocketEvents"

import ChatAgent from "./ChatAgent"
import SlackChatInterface from "./ChatInterfaces/SlackChatInterface"
import WebChatInterface from "./ChatInterfaces/WebChatInterface"

/**
 * Unified function to resume ChatAgent after integration completion (OAuth or Form).
 * Routes to the appropriate chat interface based on channel type.
 */
export async function resumeChatAgentAfterIntegration(
    userId: string,
    organizationId: string,
    chatId: string,
    channel: string,
    integrationType: IntegrationType,
    integrationId: string,
    messageTs?: string
): Promise<void> {
    try {
        const integrationName = formatIntegrationName(integrationType)

        if (channel === "web") {
            await resumeChatAgentForWeb(userId, organizationId, chatId, integrationType, integrationId, integrationName)
        } else {
            await resumeChatAgentForSlack(userId, organizationId, chatId, channel, integrationType, integrationId, integrationName, messageTs)
        }

        logger.info("ChatAgent resumed after integration completion", {
            userId,
            chatId,
            channel,
            integrationType,
            integrationId
        })
    } catch (error) {
        logger.error("Error resuming ChatAgent after integration completion", {
            error,
            userId,
            chatId,
            channel,
            integrationType,
            integrationId
        })
        // Don't throw - we don't want to break the integration flow
    }
}

async function resumeChatAgentForWeb(userId: string, organizationId: string, chatId: string, integrationType: IntegrationType, integrationId: string, integrationName: string): Promise<void> {
    const io = getRealtimeSocket()
    if (!io) {
        logger.error("Cannot resume ChatAgent: Socket.IO server not initialized", { userId, chatId })
        return
    }

    // Find a socket for this user
    const userRoom = SocketRooms.user(userId)
    const room = io.sockets.adapter.rooms.get(userRoom)

    if (!room || room.size === 0) {
        logger.warn("Cannot resume ChatAgent: User not connected via socket", { userId, chatId })
        return
    }

    // Get the first socket in the room
    const socketId = Array.from(room)[0]
    const socket = io.sockets.sockets.get(socketId) as Socket | undefined

    if (!socket) {
        logger.error("Cannot resume ChatAgent: Socket not found", { userId, chatId, socketId })
        return
    }

    const webChatInterface = new WebChatInterface(chatId, userId, socket, organizationId)
    const chatAgent = new ChatAgent(webChatInterface, chatId, userId, organizationId)

    const message = `The ${integrationName} integration has been successfully connected. Integration ID: ${integrationId}. You may Proceed!`
    await chatAgent.run(message)
}

async function resumeChatAgentForSlack(
    userId: string,
    organizationId: string,
    chatId: string,
    channel: string,
    integrationType: IntegrationType,
    integrationId: string,
    integrationName: string,
    messageTs?: string
): Promise<void> {
    // Get user's Slack integration to create WebClient
    const userSlackIntegration = await db().user_slack_integrations.findFirst({
        where: {
            user_id: userId
        },
        include: {
            slack_integration: true,
            user: true
        },
        orderBy: {
            created_at: "desc"
        }
    })

    if (!userSlackIntegration?.slack_integration) {
        logger.error("Cannot resume ChatAgent: No Slack integration found for user", { userId })
        return
    }

    // Create WebClient
    const client = initializeSlackWebClient(userSlackIntegration as any)

    // Create SlackChatInterface (organization-scoped)
    const slackChatInterface = new SlackChatInterface(channel, client, userId, organizationId, userSlackIntegration.authed_user_id, chatId)

    // If messageTs is provided, set it to replace the message instead of posting new one
    if (messageTs) {
        slackChatInterface.setMessageTsToReplace(messageTs)
    }

    // Create ChatAgent
    const chatAgent = new ChatAgent(slackChatInterface, chatId, userId, organizationId)

    // Run the agent with a message about successful connection
    const message = `The ${integrationName} integration has been successfully connected. Integration ID: ${integrationId}`
    await chatAgent.run(message)
}

function formatIntegrationName(integrationType: IntegrationType): string {
    return integrationType
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase())
}
