import { RunStreamEvent } from "@openai/agents-core";
import { ConfigType } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";
import ChatInterface from "./ChatInterface";
import { Socket } from "socket.io";

class WebChatInterface extends ChatInterface {
    name: string = 'Web';
    private readonly socket: Socket;
    
    promptForIntegration(integration: IntegrationType): Promise<string> {
        throw new Error("Method not implemented.");
    }
    promptForConfig(config: ConfigType): Promise<string> {
        throw new Error("Method not implemented.");
    }
    processStreamEvent(sessionId: string, event: RunStreamEvent): void {
        throw new Error("Method not implemented.");
    }
    processMessageEnd(sessionId: string, finalOutput: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    buildButton(label: string, url: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    constructor(sessionId: string, userId: string, socket: Socket) {
        super(sessionId, userId);
        this.socket = socket;
    }
}

export default WebChatInterface;