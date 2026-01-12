import { Agent, AgentOutputType, run, RunStreamEvent } from "@openai/agents";
import ChatInterface from "./ChatInterface";
import { buildChatAgentSystemPrompt } from "./ChatAgentSystemPrompt";
import { buildChatAgentTools } from "./ChatAgentTools";
import logger from "../../logger";

class ChatAgent {
    constructor(private readonly chatInterface: ChatInterface) {}

    async run(message: string): Promise<void> {
        logger.info('Starting chat agent run for message in interface', { message, interface: this.chatInterface.name });
        const agent = new Agent<void, AgentOutputType>({
            name: 'Living Document Automator',
            instructions: await buildChatAgentSystemPrompt(),
            model: 'gpt-5',
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
        });

        for await (const event of result as AsyncIterable<RunStreamEvent>) {
            this.chatInterface.processStreamEvent(event);
        }

        logger.info('Chat agent run completed');
    }
}