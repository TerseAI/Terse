import { Agent, AgentOutputType, RunStreamEvent, StreamedRunResult } from "@openai/agents";
import { ConfigType } from "../../shared/Configs";
import { IntegrationType } from "../../shared/Integrations";
import { Channel } from "../../shared/types";

abstract class ChatInterface {
    abstract name: string;
    protected sessionId: string | undefined;
    protected userId: string | undefined;

    setSessionId(sessionId: string): void {
        this.sessionId = sessionId;
    }

    setUserId(userId: string): void {
        this.userId = userId;
    }

    abstract buildPreview(draft: Channel): Promise<string>;
    abstract promptForIntegration(integration: IntegrationType): Promise<string>; 
    abstract promptForConfig(config: ConfigType): Promise<string>;
    abstract processStreamEvent(sessionId: string, event: RunStreamEvent): void;
    abstract processMessageEnd(sessionId: string, finalOutput: string): Promise<void>;
}

export default ChatInterface;