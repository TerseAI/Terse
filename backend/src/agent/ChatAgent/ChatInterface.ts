import { Agent, AgentOutputType, RunStreamEvent, StreamedRunResult } from "@openai/agents";
import { ConfigType } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { Channel } from "../../shared/types";

abstract class ChatInterface {
    abstract name: string;
    protected readonly sessionId: string | undefined;
    protected readonly userId: string | undefined;

    constructor(sessionId?: string, userId?: string) {
        this.sessionId = sessionId;
        this.userId = userId;
    }

    abstract buildPreview(draft: Channel): Promise<string>;
    abstract promptForIntegration(integration: IntegrationType): Promise<string>; 
    abstract promptForConfig(config: ConfigType): Promise<string>;
    abstract processStreamEvent(sessionId: string, event: RunStreamEvent): void;
    abstract processMessageEnd(sessionId: string, finalOutput: string): Promise<void>;
}

export default ChatInterface;