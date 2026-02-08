import type ChatInterface from "./ChatInterfaces/ChatInterface"

export type ChatAgentContext = {
    chatInterface: ChatInterface
    userId: string
    organizationId: string
    sessionId: string
}
