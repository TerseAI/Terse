import { RunStreamEvent } from "@openai/agents";
import { ConfigType } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";
import { AgentDraft } from "../../../routes/agents";

abstract class ChatInterface {
    abstract name: string;
    protected readonly sessionId: string;
    protected readonly userId: string;

    constructor(sessionId: string, userId: string) {
        this.sessionId = sessionId;
        this.userId = userId;
    }

    // abstract buildPreview(draft: AgentDraft): Promise<string>;
    abstract promptForIntegration(integration: IntegrationType): Promise<string>; 
    abstract promptForConfig(config: ConfigType): Promise<string>;
    abstract processStreamEvent(sessionId: string, event: RunStreamEvent): void;
    abstract processMessageEnd(sessionId: string, finalOutput: string): Promise<void>;
    abstract buildButton(label: string, url: string): Promise<void>;
    abstract navigate(path: string): Promise<void>;

    async getUserTimezone(): Promise<string | null> {
        return null;
    }
}

export default ChatInterface;