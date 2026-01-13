import { Agent, AgentOutputType, run, RunStreamEvent } from "@openai/agents";
import ChatInterface from "./ChatInterface";
import { buildChatAgentSystemPrompt } from "./ChatAgentSystemPrompt";
import { buildChatAgentTools } from "./ChatAgentTools";
import { ChatMemorySession, recentHistoryCallback } from "../CustomMemorySession";
import { getOrCreateChatSession } from "./chatSessionHelper";
import { ChatSessionType } from "@prisma/client";
import logger from "../../logger";

class ChatAgent {
    private memorySession: ChatMemorySession | null = null;

    constructor(
        private readonly chatInterface: ChatInterface,
        private readonly chatId: string // This is the external_id (e.g., Slack thread timestamp)
    ) {}

    private async getMemorySession(): Promise<ChatMemorySession> {
        if (this.memorySession) {
            return this.memorySession;
        }

        // Determine session type based on chat interface
        const sessionType = this.chatInterface.name === 'Slack' ? ChatSessionType.SLACK_THREAD : ChatSessionType.DIRECT_CHAT;
        
        // Get or create the chat session
        const chatSessionId = await getOrCreateChatSession(sessionType, this.chatId);
        
        // Create the memory session
        this.memorySession = new ChatMemorySession({
            sessionId: chatSessionId,
        });

        return this.memorySession;
    }

    async run(message: string): Promise<string> {
        logger.info('Starting chat agent run for message in interface', { message, interface: this.chatInterface.name });
        const agent = new Agent<void, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: await buildChatAgentSystemPrompt(),
            model: 'gpt-5.2',
            tools: buildChatAgentTools(this.chatInterface),
        });

        const memorySession = await this.getMemorySession();

        const result = await run(agent, [
            {
                role: 'user',
                content: message,
            },
        ], {
            stream: true,
            context: {
                chatInterface: this.chatInterface,
            },
            session: memorySession,
            sessionInputCallback: recentHistoryCallback,
        });

        for await (const event of result as AsyncIterable<RunStreamEvent>) {
            this.chatInterface.processStreamEvent(this.chatId, event);
        }

        const finalOutput = typeof result.finalOutput === 'string' ? result.finalOutput : '';
        this.chatInterface.processMessageEnd(this.chatId, finalOutput);

        logger.info('Chat agent run completed', { finalOutput });

        return finalOutput;
    }
}

export default ChatAgent;