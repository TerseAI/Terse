import chalk from "chalk";
import { IntegrationType } from "@prisma/client";
import { GmailEventData } from "../routes/gmail";
import { AutomationInput } from "../types/prisma";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";

// MARK: - Slack Event Data Type

export interface SlackEventData {
    channelId: string;
    channelName?: string;
    userId: string;
    userName?: string;
    text: string;
    timestamp: string;
    threadTimestamp?: string;
    teamId: string;
    // Permalink for the message (if available)
    permalink?: string;
}

export abstract class InputEvent {
    abstract readonly integrationType: IntegrationType;

    constructor() {
        // No initialization needed - integrationType is set by subclasses
    }

    // This method will be used to format the Event into the format expected by the LLM. MUST BE A STRING
    abstract formatForAutomationAgent(): string;

    // Use this for formatting how we log this
    abstract debugLog(): string;

    /**
     * Check if this event matches the given automation input.
     * Each event subclass implements its own filtering logic.
     * @param automationInput The automation input to check against (with config relations loaded)
     * @returns true if this event matches the automation input
     */
    abstract matchesAutomationInput(automationInput: AutomationInput): boolean;

    /**
     * Create trigger metadata for run history.
     * Each event subclass implements its own metadata extraction.
     * @returns RunHistoryTrigger with event-specific fields
     */
    abstract createTriggerMetadata(): RunHistoryTrigger;
}

// MARK: - GMAIL Event

export class GmailEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.GMAIL;
    data: GmailEventData;
    
    constructor(data: GmailEventData) {
        super();
        this.data = data;
    }

    formatForAutomationAgent(): string {
        return `
        Incoming Email Event.

        Gmail Event:
        Subject: ${this.data.subject}
        From: ${this.data.from}
        To: ${this.data.to}
        Date: ${this.data.date}
        Message ID: ${this.data.messageId}
        Body: ${this.data.body}
        Snippet: ${this.data.snippet}
        `;
    }

    debugLog(): string {
        return `Gmail Event: ${this.data.subject} message ID: ${this.data.messageId}`;
    }

    matchesAutomationInput(automationInput: AutomationInput): boolean {
        // Check if integration type matches
        if (automationInput.integration_type !== IntegrationType.GMAIL) {
            return false;
        }

        // Currently Gmail has no config-based filtering (no gmail_config filters),
        // but structure supports future addition
        // For now, if integration type matches, the event matches
        return true;
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: 'email_received',
            integration: 'gmail',
            source: this.data.to || 'Gmail',
            title: this.data.subject,
            subheader: this.data.from,
            url: undefined, // Gmail doesn't provide direct message URLs in webhook
        };
    }
}

// MARK: - SLACK Event

export class SlackEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.SLACK;
    data: SlackEventData;
    
    constructor(data: SlackEventData) {
        super();
        this.data = data;
    }

    formatForAutomationAgent(): string {
        return `
        Incoming Slack Message Event.

        Slack Event:
        Channel: ${this.data.channelName || this.data.channelId}
        User: ${this.data.userName || this.data.userId}
        Message: ${this.data.text}
        Timestamp: ${this.data.timestamp}
        ${this.data.threadTimestamp ? `Thread: ${this.data.threadTimestamp}` : ''}
        Team ID: ${this.data.teamId}
        `;
    }

    debugLog(): string {
        return `Slack Event: ${this.data.channelName || this.data.channelId} - ${this.data.userName || this.data.userId} - ${this.data.text.substring(0, 50)}`;
    }

    matchesAutomationInput(automationInput: AutomationInput): boolean {
        // Check if integration type matches
        if (automationInput.integration_type !== IntegrationType.SLACK) {
            return false;
        }

        // If automationInput has slack_config with channel_id, filter by channel
        // Otherwise, all Slack events match (no channel filtering)
        const slackConfig = (automationInput as any).slack_config;
        if (slackConfig?.channel_id) {
            // If config specifies a channel, event must match that channel
            return this.data.channelId === slackConfig.channel_id;
        }

        // No channel config means all Slack events match
        return true;
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: 'message_received',
            integration: 'slack',
            source: this.data.channelName || this.data.channelId,
            title: this.data.text.substring(0, 100), // First 100 chars of message
            subheader: this.data.userName || this.data.userId,
            url: this.data.permalink,
        };
    }
}