import { Agent, AgentOutputType, RunStreamEvent, StreamedRunResult } from "@openai/agents";
import { ConfigType } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { Channel } from "../../shared/types";

abstract class ChatInterface {
    abstract name: string;

    abstract buildPreview(draft: Channel): Promise<string>;
    abstract promptForIntegration(integration: IntegrationType): Promise<string>; 
    abstract promptForConfig(config: ConfigType): Promise<string>;
    abstract processStreamEvent(chatId: string, event: RunStreamEvent): void;
    abstract processMessageEnd(chatId: string, finalOutput: string): void;
}

export default ChatInterface;