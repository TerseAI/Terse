import chalk from "chalk";
import { IntegrationType } from "@prisma/client";
import { GmailEventData } from "../routes/gmail";
import { AutomationInput } from "../types/prisma";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { SlackEventData, SlackChannelType } from "../shared/types";
import { FigmaCommentEventData } from "../shared/types";

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

    /**
     * Get image URLs associated with this event.
     * Events that include images (e.g., Figma comments with visual context) should return their URLs here.
     * @returns Array of image URL strings. Empty array if no images are available.
     */
    abstract getImageUrls(): string[];
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

    getImageUrls(): string[] {
        // Gmail events don't include images
        return [];
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

    getImageUrls(): string[] {
        // Slack events don't currently include images
        // Future: could extract image URLs from message attachments if needed
        return [];
    }
}

// MARK: - FIGMA Comment Event

export class FigmaCommentEvent extends InputEvent {
    readonly integrationType: IntegrationType = IntegrationType.FIGMA;
    data: FigmaCommentEventData;
    
    constructor(data: FigmaCommentEventData) {
        super();
        this.data = data;
    }

    formatForAutomationAgent(): string {
        const indentMultiline = (text: string): string =>
            text
                .split('\n')
                .map((line) => `        ${line}`)
                .join('\n');

        const nodeInfo = this.data.nodeId
            ? `\nNode Context:\n${indentMultiline(`Node ID: ${this.data.nodeId}`)}`
            : `\nNode Context:\n${indentMultiline('Comment is on the file level (not attached to a specific node)')}`;

        const fileInfo = this.data.fileMetadata
            ? `\nFile Metadata:\n${indentMultiline(JSON.stringify(this.data.fileMetadata, null, 2))}`
            : '';

        const positioningInfo = this.data.positioningData
            ? `\nPositioning Details:\n${indentMultiline(`Type: ${this.data.positioningData.type}`)}\n${indentMultiline('Data:')}` +
              `\n${indentMultiline(JSON.stringify(this.data.positioningData.data, null, 2))}`
            : '';

        const matchedNodesInfo = this.data.matchedNodeIds && this.data.matchedNodeIds.length > 0
            ? `\nMatched Design Elements:\n${indentMultiline(this.data.matchedNodeIds.map((id) => `- ${id}`).join('\n'))}`
            : '';

        let imageInfo = '';
        if (this.data.imageUrls) {
            const imageLines: string[] = [];
            if (this.data.imageUrls.nodeImage) {
                imageLines.push(`- Primary Node Image: ${this.data.imageUrls.nodeImage}`);
            }
            if (this.data.imageUrls.fullFrame) {
                imageLines.push(`- Full Frame Image: ${this.data.imageUrls.fullFrame}`);
            }
            if (imageLines.length > 0) {
                imageLines.push('- Note: Use these images to understand what element the comment refers to.');
                imageInfo = `\nVisual Context:\n${indentMultiline(imageLines.join('\n'))}`;
            }
        }

        const threadEntries = this.data.thread ?? [];
        const threadInfo = threadEntries.length > 0
            ? `\nConversation Thread:\n${indentMultiline(threadEntries.map((entry) => {
                const role = entry.isRoot ? 'root comment' : 'reply';
                const isCurrent = entry.id === this.data.commentId ? ' (event comment)' : '';
                const header = `- ${entry.author.handle} on ${entry.createdAt} [${role}]${isCurrent}`;
                const message = entry.message ? `  ${entry.message.replace(/\n/g, '\n  ')}` : '  (no message)';
                return `${header}\n${message}`;
            }).join('\n'))}`
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
        Resolved: ${this.data.resolved ? 'Yes' : 'No'}${nodeInfo}${fileInfo}${positioningInfo}${matchedNodesInfo}${imageInfo}${threadInfo}
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

        // Require file_key to be configured and match the event's file_key
        const figmaConfig = (automationInput as any).figma_config;
        if (!figmaConfig?.file_key) {
            // No file_key configured means this automation should not match any events
            return false;
        }

        // Event's file_key must match the automation input's file_key
        return this.data.fileKey === figmaConfig.file_key;
    }

    createTriggerMetadata(): RunHistoryTrigger {
        // Get file name from metadata, fall back to file key if not available
        const fileName = this.data.fileMetadata?.name || this.data.fileKey;
        const subheader = `${this.data.author.handle} on ${fileName}`;
        
        return {
            event: 'comment_added',
            integration: 'figma',
            source: this.data.fileKey,
            title: this.data.message.substring(0, 100), // First 100 chars of comment
            subheader: subheader,
            url: this.data.fileUrl,
        };
    }

    getImageUrls(): string[] {
        // Return all available image URLs from the Figma comment event
        const urls: string[] = [];
        if (this.data.imageUrls) {
            if (this.data.imageUrls.nodeImage) {
                urls.push(this.data.imageUrls.nodeImage);
            }
            if (this.data.imageUrls.fullFrame) {
                urls.push(this.data.imageUrls.fullFrame);
            }
        }
        return urls;
    }
}