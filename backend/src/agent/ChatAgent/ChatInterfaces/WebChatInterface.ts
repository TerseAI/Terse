import { RunStreamEvent } from "@openai/agents-core"
import { Socket } from "socket.io"
import { uuidv4 } from "zod/v4"

import { INTEGRATION_REGISTRY } from "../../../integrations/abstract/IntegrationRegistry"
import logger from "../../../logger"
import { ConfigType } from "../../../shared/Configs"
import { IntegrationType } from "../../../shared/Integrations"
import { ModelEvent } from "../../../shared/ModelEvents"
import { SocketEvents } from "../../../shared/SocketEvents"
import type { MultipleChoiceQuestion } from "../../../shared/Survey"
import { createOAuthStateToken } from "../../../utility/oauth"
import {
    createNaturalStopEvent,
    createToolCallCompleteEvent,
    tryExtractTextDelta,
    tryExtractThinking,
    tryExtractToolCall,
    tryExtractToolCallCompleteData,
    tryExtractToolCallGenerating
} from "../../streaming"

import ChatInterface from "./ChatInterface"

class WebChatInterface extends ChatInterface {
    name: string = "Web"
    private readonly socket: Socket
    private readonly timezone: string | null

    constructor(sessionId: string, userId: string, socket: Socket, organizationId?: string, timezone?: string) {
        super(sessionId, userId, organizationId)
        this.socket = socket
        this.timezone = timezone ?? null
    }

    async getUserTimezone(): Promise<string | null> {
        return this.timezone
    }

    private emitEvent(event: ModelEvent): void {
        this.socket.emit(SocketEvents.BUILDER_CHAT_EVENT, {
            sessionId: this.sessionId,
            event: { ...event, timestamp: Date.now() }
        })
    }

    async promptForIntegration(integration: IntegrationType): Promise<string> {
        logger.info("Web chat interface promptForIntegration", {
            integration,
            userId: this.userId
        })

        if (!this.userId) {
            logger.error("Cannot prompt for integration: userId is not available")
            return "Unable to get authorization URL. Please ensure you are properly authenticated."
        }

        const integrationManager = INTEGRATION_REGISTRY.find(int => int.integrationType === integration)

        if (!integrationManager) {
            logger.error("Integration not found", { integration })
            return `Integration ${integration} not found.`
        }

        // Create state token with chat metadata for both OAuth and form integrations (organization-scoped)
        const stateToken = createOAuthStateToken({
            userId: this.userId!,
            organizationId: this.organizationId ?? "",
            additionalFields: { integrationType: integration },
            additionalStatePayload: {
                chatId: this.sessionId,
                channel: "web"
            },
            expiresIn: "7d"
        })

        // Emit integration_prompt snippet - works for both OAuth and form integrations
        // The integration card will handle fetching OAuth URLs or showing forms
        this.emitEvent({
            type: "Snippet",
            snippet: {
                type: "integration_prompt",
                integration,
                message: `To connect ${integration}, please use the form or button below.`,
                stateToken
            }
        })

        try {
            const { integrationId } = await this.waitForIntegrationCompletion(integration)
            let response = `Integration ${integration} connected successfully. Integration ID: ${integrationId}. You can now use it in the agent.`
            if (integration === IntegrationType.SLACK) {
                response += `\n\nIMPORTANT: After connecting Slack as a bot, you'll need to invite the Terse bot to each channel you want it to access. In Slack, go to the channel and type /invite @Terse. Only channels where the bot has been invited will be available for automations.`
            }
            return response
        } catch {
            return "The user did not complete the integration in time. You can prompt again or suggest they complete it later."
        }
    }

    async promptForConfig(config: ConfigType): Promise<string> {
        logger.info("Web chat interface promptForConfig", { config })
        // For web, configuration is typically handled through the UI
        return `To configure ${config}, please use the settings panel in the interface.`
    }

    async askSurveyQuestion(multipleChoiceQuestion: MultipleChoiceQuestion): Promise<string> {
        const questionId = uuidv4().toString()
        this.emitEvent({
            type: "Snippet",
            snippet: {
                type: "multiple_choice",
                questionId,
                question: multipleChoiceQuestion.question,
                options: multipleChoiceQuestion.options,
                ...(multipleChoiceQuestion.allowMultiple ? { allowMultiple: true } : {})
            }
        })
        try {
            const answer = await this.waitForSurveyAnswer(questionId)
            return `The user answered: ${answer}`
        } catch {
            return "The user did not answer in time. You can ask the question again."
        }
    }

    processStreamEvent(sessionId: string, event: RunStreamEvent): void {
        const thinkingEvent = tryExtractThinking(event)
        if (thinkingEvent) {
            this.emitEvent(thinkingEvent)
            return
        }

        const textDelta = tryExtractTextDelta(event)
        if (textDelta) {
            this.emitEvent(textDelta)
            return
        }

        // Check for tool call generating (before arguments are complete)
        const toolCallGenerating = tryExtractToolCallGenerating(event)
        if (toolCallGenerating) {
            this.emitEvent(toolCallGenerating)
            return
        }

        const toolCall = tryExtractToolCall(event)
        if (toolCall) {
            this.emitEvent(toolCall)
            return
        }

        const toolCompleteData = tryExtractToolCallCompleteData(event)
        if (toolCompleteData) {
            const toolCompleteEvent = createToolCallCompleteEvent(toolCompleteData, [])
            this.emitEvent(toolCompleteEvent)
            if (toolCompleteData.snippets?.length) {
                for (const snippet of toolCompleteData.snippets) {
                    this.emitEvent({
                        type: "Snippet",
                        snippet
                    })
                }
            }
            return
        }
    }

    async processMessageEnd(sessionId: string, finalOutput: string): Promise<void> {
        logger.info("Web chat interface processMessageEnd", {
            sessionId,
            finalOutput
        })

        // Emit a NaturalStop event to signal the end of the message
        this.emitEvent(createNaturalStopEvent())
    }

    async buildButton(label: string, url: string): Promise<void> {
        this.emitEvent({
            type: "Snippet",
            snippet: {
                type: "button",
                label,
                url
            }
        })
    }

    async navigate(path: string): Promise<void> {
        this.emitEvent({
            type: "Snippet",
            snippet: {
                type: "navigate",
                path
            }
        })
    }
}

export default WebChatInterface
