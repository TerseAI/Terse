import chalk from "chalk";
import { IntegrationType } from "@prisma/client";
import { GmailEventData } from "../routes/gmail";
import { AutomationInput } from "../types/prisma";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { SlackEventData, SlackChannelType } from "../shared/types";
import { FigmaCommentEventData, FigmaCommentThreadEntry } from "../shared/types";

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
                imageInfo = `Visual Context:\n${indentMultiline(imageLines.join('\n'))}`;
            }
        }

        const threadEntries = this.data.thread ? [...this.data.thread] : [];
        const currentThreadEntry = threadEntries.find((entry) => entry.id === this.data.commentId);
        const parentThreadEntry = currentThreadEntry?.parentId
            ? threadEntries.find((entry) => entry.id === currentThreadEntry.parentId)
            : undefined;
        const rootThreadEntry = threadEntries.find((entry) => entry.isRoot) ?? threadEntries[0];

        const formatThreadMessage = (entry: FigmaCommentThreadEntry): string => {
            const flags: string[] = [];
            if (entry.isRoot) {
                flags.push('root comment');
            }
            if (entry.id === this.data.commentId) {
                flags.push('current event');
            }
            if (entry.parentId && entry.parentId !== entry.id) {
                flags.push('reply');
            }
            if (entry.resolvedAt) {
                flags.push(`resolved on ${entry.resolvedAt}`);
            }

            const metadata = flags.length > 0 ? ` [${flags.join(' | ')}]` : '';
            const header = `${entry.author.handle} on ${entry.createdAt}${metadata}`;
            const messageBody = entry.message && entry.message.trim().length > 0
                ? entry.message.split('\n').map((line) => `  ${line}`).join('\n')
                : '  (no message)';

            return `${header}\n${messageBody}`;
        };

        const formatContextEntry = (entry: FigmaCommentThreadEntry): string => {
            const header = `${entry.author.handle} on ${entry.createdAt}`;
            const messageBody = entry.message && entry.message.trim().length > 0
                ? entry.message.split('\n').map((line) => `  ${line}`).join('\n')
                : '  (no message)';

            return `${header}\n${messageBody}`;
        };

        const messageBlock = this.data.message && this.data.message.trim().length > 0
            ? `Comment Message:\n${indentMultiline(this.data.message)}`
            : '';

        const directParentBlock = parentThreadEntry && parentThreadEntry.id !== this.data.commentId
            ? `Direct Parent Comment:\n${indentMultiline(formatContextEntry(parentThreadEntry))}`
            : '';

        const rootThreadBlock = rootThreadEntry
            && rootThreadEntry.id !== this.data.commentId
            && rootThreadEntry.id !== parentThreadEntry?.id
            ? `Thread Starting Comment:\n${indentMultiline(formatContextEntry(rootThreadEntry))}`
            : '';

        const threadInfo = threadEntries.length > 0
            ? `Full Comment Thread (oldest → newest):\n${indentMultiline(threadEntries.map((entry, index) => {
                const prefix = `${index + 1}. `;
                const formatted = formatThreadMessage(entry).split('\n');
                const withIndex = [formatted[0] ? `${prefix}${formatted[0]}` : prefix, ...formatted.slice(1)];
                return withIndex.join('\n');
            }).join('\n\n'))}`
            : '';

        const conversationContextSections = [
            messageBlock,
            directParentBlock,
            rootThreadBlock,
            threadInfo,
        ].filter((section) => section && section.trim().length > 0);

        const conversationContext = conversationContextSections.join('\n\n');

        const fileName = typeof this.data.fileMetadata?.name === 'string'
            ? this.data.fileMetadata.name
            : null;
        const folderName = typeof this.data.fileMetadata?.folder_name === 'string'
            ? this.data.fileMetadata.folder_name
            : null;

        const designContextLines: string[] = [];
        designContextLines.push(`Design File: ${fileName || 'Untitled Figma file'}`);
        if (folderName) {
            designContextLines.push(`Location: ${folderName}`);
        }
        designContextLines.push(`Open in Figma: ${this.data.fileUrl}`);

        const designContext = `Context:\n${indentMultiline(designContextLines.join('\n'))}`;

        const summarySection = [
            'Incoming Figma Comment Event',
            `Author: ${this.data.author.handle}`,
            `Created: ${this.data.createdAt}`,
            `Status: ${this.data.resolved ? 'Resolved' : 'Open'}`,
        ].join('\n');

        const sections = [
            summarySection,
            designContext,
            conversationContext,
            imageInfo,
        ].filter((section) => section && section.trim().length > 0);

        return `${sections.join('\n\n')}\n`;
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