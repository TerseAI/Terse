import chalk from "chalk";
import { IntegrationType } from "@prisma/client";
import { GmailEventData } from "../routes/gmail";
import { AutomationInput } from "../types/prisma";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { SlackChannelType } from "../slack/eventHandler";


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
    channelType?: SlackChannelType;
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

        const isChannelOrGroup = (
            this.data.channelType === SlackChannelType.CHANNEL ||
            this.data.channelType === SlackChannelType.GROUP
        )
        const isDM = (
            this.data.channelType === SlackChannelType.IM ||
            this.data.channelType === SlackChannelType.MPIM
        )

        const matchesChannelOrGroup = isChannelOrGroup && this.data.channelId === slackConfig.channel_id;
        const matchesDM = isDM && slackConfig?.listen_to_user_dms
        return (
            matchesChannelOrGroup || matchesDM
        )
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

// MARK: - FIGMA Comment Event

export interface FigmaCommentEventData {
    commentId: string;
    fileKey: string;
    fileUrl: string;
    nodeId?: string; // Node ID the comment is attached to (if any)
    message: string;
    author: {
        id: string;
        handle: string;
        img_url?: string;
    };
    createdAt: string;
    resolved?: boolean;
    // Enriched context (optional - added during processing)
    nodeContext?: any;
    fileMetadata?: any;
}

export class FigmaCommentEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.FIGMA;
    data: FigmaCommentEventData;
    
    constructor(data: FigmaCommentEventData) {
        super();
        this.data = data;
    }

    formatForAutomationAgent(): string {
        const nodeInfo = this.data.nodeId 
            ? `\nNode ID: ${this.data.nodeId}\nNode Context: ${JSON.stringify(this.data.nodeContext || {}, null, 2)}`
            : '\nComment is on the file level (not attached to a specific node)';
        
        const fileInfo = this.data.fileMetadata 
            ? `\nFile Metadata: ${JSON.stringify(this.data.fileMetadata, null, 2)}`
            : '';

        return `
        Incoming Figma Comment Event.

        Figma Comment:
        File: ${this.data.fileKey}
        File URL: ${this.data.fileUrl}
        Comment ID: ${this.data.commentId}
        Author: ${this.data.author.handle} (${this.data.author.id})
        Message: ${this.data.message}
        Created At: ${this.data.createdAt}
        Resolved: ${this.data.resolved ? 'Yes' : 'No'}${nodeInfo}${fileInfo}
        `;
    }

    debugLog(): string {
        return `Figma Comment Event: File ${this.data.fileKey} - ${this.data.author.handle} - ${this.data.message.substring(0, 50)}`;
    }

    matchesAutomationInput(automationInput: AutomationInput): boolean {
        // Check if integration type matches
        if (automationInput.integration_type !== IntegrationType.FIGMA) {
            return false;
        }

        // If automationInput has figma_config with file_key, filter by file
        const figmaConfig = (automationInput as any).figma_config;
        if (figmaConfig?.file_key) {
            // If config specifies a file, event must match that file
            return this.data.fileKey === figmaConfig.file_key;
        }

        // No file config means all Figma comment events match
        return true;
    }

    createTriggerMetadata(): RunHistoryTrigger {
        return {
            event: 'comment_added',
            integration: 'figma',
            source: this.data.fileKey,
            title: this.data.message.substring(0, 100), // First 100 chars of comment
            subheader: `${this.data.author.handle} on ${this.data.fileKey}`,
            url: this.data.fileUrl,
        };
    }
}