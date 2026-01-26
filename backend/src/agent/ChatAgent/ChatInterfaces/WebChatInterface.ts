import { RunStreamEvent } from "@openai/agents-core";
import { ConfigType } from "../../../shared/Configs";
import { IntegrationType } from "../../../shared/Integrations";
import ChatInterface from "./ChatInterface";
import { Socket } from "socket.io";
import logger from "../../../logger";
import { SocketEvents } from "../../../shared/SocketEvents";
import { ModelEvent } from "../../../shared/ModelEvents";
import {
    tryExtractThinking,
    tryExtractTextDelta,
    tryExtractToolCall,
    tryExtractToolCallCompleteData,
    createToolCallCompleteEvent,
    createNaturalStopEvent,
} from "../../streaming";
import { INTEGRATION_REGISTRY } from "../../../integrations/abstract/IntegrationRegistry";
import {
    isOAuthIntegrationInstallation,
    isFormIntegrationInstallation,
    OAuthIntegrationInstallation,
} from "../../../integrations/abstract/Integration";

class WebChatInterface extends ChatInterface {
    name: string = 'Web';
    private readonly socket: Socket;

    constructor(sessionId: string, userId: string, socket: Socket) {
        super(sessionId, userId);
        this.socket = socket;
    }

    private emitEvent(event: ModelEvent): void {
        this.socket.emit(SocketEvents.BUILDER_CHAT_EVENT, {
            sessionId: this.sessionId,
            event,
        });
    }

    async promptForIntegration(integration: IntegrationType): Promise<string> {
        logger.info('Web chat interface promptForIntegration', { integration, userId: this.userId });

        if (!this.userId) {
            logger.error('Cannot prompt for integration: userId is not available');
            return 'Unable to get authorization URL. Please ensure you are properly authenticated.';
        }

        const integrationManager = INTEGRATION_REGISTRY.find(
            (int) => int.integrationType === integration
        );

        if (!integrationManager) {
            logger.error('Integration not found', { integration });
            return `Integration ${integration} not found.`;
        }

        if (isFormIntegrationInstallation(integrationManager)) {
            // For form-based integrations, the user needs to go to settings to configure
            return `To connect ${integration}, please go to Settings > Integrations and fill out the required form.`;
        }

        if (isOAuthIntegrationInstallation(integrationManager)) {
            return await this.handleOAuthIntegration(integration, integrationManager);
        }

        return `Integration ${integration} does not support installation.`;
    }

    private async handleOAuthIntegration(
        integration: IntegrationType,
        integrationManager: OAuthIntegrationInstallation<IntegrationType>
    ): Promise<string> {
        try {
            const configFields = integrationManager.getConfigurationFields();

            if (configFields.length > 0) {
                // Integration requires configuration before OAuth
                return `To connect ${integration}, please go to Settings > Integrations to configure and authorize it.`;
            }

            // No configuration needed - get the OAuth URL directly
            const installationDetails = await integrationManager.getInstallationUrl(this.userId!, undefined, {
                sessionId: this.sessionId,
            });
            const oauthUrl = installationDetails.oauthUrl;

            // Emit a button event to the frontend
            await this.buildButton(`Connect ${integration}`, oauthUrl);

            return `I've provided a button to connect ${integration}. Click it to start the authorization process.`;
        } catch (error) {
            logger.error('Error getting installation URL', { error, integration, userId: this.userId });
            return `Failed to get authorization URL for ${integration}. Please try again.`;
        }
    }

    async promptForConfig(config: ConfigType): Promise<string> {
        logger.info('Web chat interface promptForConfig', { config });
        // For web, configuration is typically handled through the UI
        return `To configure ${config}, please use the settings panel in the interface.`;
    }

    processStreamEvent(sessionId: string, event: RunStreamEvent): void {
        const thinkingEvent = tryExtractThinking(event);
        if (thinkingEvent) {
            this.emitEvent(thinkingEvent);
            return;
        }

        const textDelta = tryExtractTextDelta(event);
        if (textDelta) {
            this.emitEvent(textDelta);
            return;
        }

        const toolCall = tryExtractToolCall(event);
        if (toolCall) {
            this.emitEvent(toolCall);
            return;
        }

        const toolCompleteData = tryExtractToolCallCompleteData(event);
        if (toolCompleteData) {
            const toolCompleteEvent = createToolCallCompleteEvent(toolCompleteData, []);
            this.emitEvent(toolCompleteEvent);
            return;
        }
    }

    async processMessageEnd(sessionId: string, finalOutput: string): Promise<void> {
        logger.info('Web chat interface processMessageEnd', { sessionId, finalOutput });

        // Emit a NaturalStop event to signal the end of the message
        this.emitEvent(createNaturalStopEvent());
    }

    async buildButton(label: string, url: string): Promise<void> {
        // Emit a TextDelta with a markdown link that the frontend can render as a button
        // The frontend can parse this and display it as a clickable button
        const buttonMarkdown = `\n\n[${label}](${url})\n\n`;
        this.emitEvent({
            type: "TextDelta",
            delta: buttonMarkdown,
            step_id: `button_${Date.now()}`,
        });
    }
}

export default WebChatInterface;