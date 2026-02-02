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
    tryExtractToolCallGenerating,
    tryExtractToolCall,
    tryExtractToolCallCompleteData,
    createToolCallCompleteEvent,
    createNaturalStopEvent,
} from "../../streaming";
import { INTEGRATION_REGISTRY } from "../../../integrations/abstract/IntegrationRegistry";
import { createOAuthStateToken } from "../../../utility/oauth";

class WebChatInterface extends ChatInterface {
    name: string = 'Web';
    private readonly socket: Socket;

    constructor(sessionId: string, userId: string, socket: Socket, organizationId?: string) {
        super(sessionId, userId, organizationId);
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

        // Create state token with chat metadata for both OAuth and form integrations (organization-scoped)
        const stateToken = createOAuthStateToken({
            userId: this.userId!,
            organizationId: this.organizationId ?? '',
            additionalFields: { integrationType: integration },
            additionalStatePayload: {
                chatId: this.sessionId,
                channel: 'web',
            },
            expiresIn: "7d",
        });

        // Emit integration_prompt snippet - works for both OAuth and form integrations
        // The integration card will handle fetching OAuth URLs or showing forms
        this.emitEvent({
            type: 'Snippet',
            snippet: {
                type: 'integration_prompt',
                integration,
                message: `To connect ${integration}, please use the form or button below.`,
                stateToken,
            },
        });

        let response = `I've provided a way to connect ${integration}. Use the form or button below to complete the integration.`;

        // Add Slack-specific guidance about channel access
        if (integration === IntegrationType.SLACK) {
            response += `\n\nIMPORTANT: After connecting Slack as a bot, you'll need to invite the Terse bot to each channel you want it to access. In Slack, go to the channel and type /invite @Terse. Only channels where the bot has been invited will be available for automations.`;
        }

        return response;
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

        // Check for tool call generating (before arguments are complete)
        const toolCallGenerating = tryExtractToolCallGenerating(event);
        if (toolCallGenerating) {
            this.emitEvent(toolCallGenerating);
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
        this.emitEvent({
            type: 'Snippet',
            snippet: {
                type: 'button',
                label,
                url,
            },
        });
    }

    async navigate(path: string): Promise<void> {
        this.emitEvent({
            type: 'Snippet',
            snippet: {
                type: 'navigate',
                path,
            },
        });
    }
}

export default WebChatInterface;