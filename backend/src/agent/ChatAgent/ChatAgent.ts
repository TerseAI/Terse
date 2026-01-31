import { Agent, AgentOutputType, run, RunStreamEvent } from "@openai/agents";
import logger from "../../logger";
import {
  ChatMemorySession,
  recentHistoryCallback,
} from "../CustomMemorySession";
import { buildChatAgentSystemPrompt } from "./ChatAgentSystemPrompt";
import { buildChatAgentTools, type ChatAgentContext } from "./ChatAgentTools";
import ChatInterface from "./ChatInterface";

class ChatAgent {
  private memorySession: ChatMemorySession | null = null;

  constructor(
    private readonly chatInterface: ChatInterface,
    private readonly sessionId: string, // This is the external_id (e.g., Slack thread timestamp)
    private readonly userId: string, // Required userId for interfaces
    private readonly organizationId: string, // Required organizationId for interfaces
  ) {}

  private async getMemorySession(): Promise<ChatMemorySession> {
    if (this.memorySession) {
      return this.memorySession;
    }

    // Create the memory session
    this.memorySession = new ChatMemorySession({
      sessionId: this.sessionId,
    });

    return this.memorySession;
  }

  async run(message: string): Promise<string> {
    logger.info("Starting chat agent run for message in interface", {
      message,
      interface: this.chatInterface.name,
    });
    const userTimezone = await this.chatInterface.getUserTimezone();
    const agent = new Agent<ChatAgentContext, AgentOutputType>({
      name: "Terse Automation Assistant",
      instructions: await buildChatAgentSystemPrompt(
        this.userId,
        this.organizationId,
        userTimezone,
      ),
      model: "gpt-5.2",
      tools: buildChatAgentTools(this.chatInterface),
    });

    const memorySession = await this.getMemorySession();

    const result = await run(
      agent,
      [
        {
          role: "user",
          content: message,
        },
      ],
      {
        stream: true,
        context: {
          chatInterface: this.chatInterface,
          userId: this.userId,
        },
        session: memorySession,
        sessionInputCallback: recentHistoryCallback,
      },
    );

    for await (const event of result as AsyncIterable<RunStreamEvent>) {
      this.chatInterface.processStreamEvent(this.sessionId, event);
    }

    const finalOutput =
      typeof result.finalOutput === "string" ? result.finalOutput : "";
    await this.chatInterface.processMessageEnd(this.sessionId, finalOutput);

    logger.info("Chat agent run completed", { finalOutput });

    return finalOutput;
  }
}

export default ChatAgent;
