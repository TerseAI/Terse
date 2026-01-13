import { Agent, AgentOutputType, run, RunStreamEvent } from "@openai/agents";
import ChatInterface from "./ChatInterface";
import { buildChatAgentSystemPrompt } from "./ChatAgentSystemPrompt";
import { buildChatAgentTools } from "./ChatAgentTools";
import { RunHistoryChatMemorySession, recentHistoryCallback } from "../CustomMemorySession";
import logger from "../../logger";

class ChatAgent {
    private memorySession: RunHistoryChatMemorySession;

    constructor(
        private readonly chatInterface: ChatInterface,
        private readonly chatId: string
    ) {
        this.memorySession = new RunHistoryChatMemorySession({
            sessionId: chatId,
        });
    }

    async run(message: string): Promise<string> {
        logger.info('Starting chat agent run for message in interface', { message, interface: this.chatInterface.name });
        const agent = new Agent<void, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: await buildChatAgentSystemPrompt(),
            model: 'gpt-5.2',
            tools: buildChatAgentTools(this.chatInterface),
        });

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
            session: this.memorySession,
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