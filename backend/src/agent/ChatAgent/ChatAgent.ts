import { Agent, AgentOutputType, RunStreamEvent } from "@openai/agents"

import { settings } from "../../config/settings"
import logger from "../../logger"
import { User } from "../../shared/types"
import { ChatMemorySession, recentHistoryCallback } from "../CustomMemorySession"
import { AgentType, builderProviderDataModelSettings, runnerFactory } from "../runner"
import { createUserMessageItem } from "../userMessage"

import type { ChatAgentContext } from "./ChatAgentContext"
import { buildChatAgentSystemPrompt } from "./ChatAgentSystemPrompt"
import { buildChatAgentTools } from "./ChatAgentTools"
import ChatInterface from "./ChatInterfaces/ChatInterface"

const CHAT_AGENT_MAX_TURNS = 50

class ChatAgent {
    private memorySession: ChatMemorySession | null = null

    constructor(
        private readonly chatInterface: ChatInterface,
        private readonly sessionId: string, // This is the external_id (e.g., Slack thread timestamp)
        private readonly user: User,
        private readonly uiState?: string | null // UI context from the web interface
    ) {}

    private async getMemorySession(): Promise<ChatMemorySession> {
        if (this.memorySession) {
            return this.memorySession
        }

        // Create the memory session
        this.memorySession = new ChatMemorySession({
            sessionId: this.sessionId
        })

        return this.memorySession
    }

    async run(message: string): Promise<string> {
        logger.info("Starting chat agent run for message in interface", {
            message,
            interface: this.chatInterface.name
        })
        const userTimezone = await this.chatInterface.getUserTimezone()

        const runConfig = {
            agentId: "chat-agent",
            agentType: AgentType.CHAT,
            runId: this.sessionId,
            user: this.user,
            env: settings.nodeEnv
        }

        const agent = new Agent<ChatAgentContext, AgentOutputType>({
            name: "Terse Automation Assistant",
            instructions: await buildChatAgentSystemPrompt(this.user.id, this.user.organizationId, userTimezone, this.uiState),
            model: "gpt-5.2",
            tools: buildChatAgentTools(this.chatInterface),
            modelSettings: builderProviderDataModelSettings(runConfig)
        })

        const memorySession = await this.getMemorySession()

        const runner = runnerFactory(runConfig)

        const result = await runner.run(agent, [createUserMessageItem(message)], {
            stream: true,
            context: {
                chatInterface: this.chatInterface,
                user: this.user,
                sessionId: this.sessionId
            },
            session: memorySession,
            sessionInputCallback: recentHistoryCallback,
            maxTurns: CHAT_AGENT_MAX_TURNS
        })

        for await (const event of result as AsyncIterable<RunStreamEvent>) {
            this.chatInterface.processStreamEvent(this.sessionId, event)
        }

        const finalOutput = typeof result.finalOutput === "string" ? result.finalOutput : ""
        await this.chatInterface.processMessageEnd(this.sessionId, finalOutput)

        logger.info("Chat agent run completed", { finalOutput })

        return finalOutput
    }
}

export default ChatAgent
