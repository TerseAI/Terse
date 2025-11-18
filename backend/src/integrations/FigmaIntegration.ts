import { Integration } from "./abstract/Integration";
import { db } from "../prismaClient";
import { AutomationInputWithConfigs, User } from "../types/prisma";
import { figma_integrations } from "@prisma/client";
import chalk from "chalk";
import { EventProcessor } from "../agent/AutomationAgent/EventProcessor";
import { IntegrationType } from "@prisma/client";
import { RunHistoryTrigger } from "../shared/RunHistoryTypes";
import { InputEvent } from "./abstract/InputEvent";
import {
    FigmaCommentEventData,
    FigmaCommentThreadEntry,
    FigmaEventTypes,
    FigmaCommentImageUrls,
    FigmaIntegration,
    FigmaWebhookUser,
} from "../shared/types";
import {
    fetchFileMetadata,
    mapCommentToDesignElements,
    extractCommentImages,
    fetchFigmaCommentThreadFromApi,
    resolvePositioningContext,
} from "../utility/figmaUtils";

export class FigmaIntegrationManager implements Integration<FigmaIntegration, FigmaWebhookEvent> {
    constructor() { }

    async getInstancesForUser(userId: string): Promise<FigmaIntegration[]> {
        const integrations = await db().figma_integrations.findMany({
            where: {
                user_id: userId,
            },
        });
        return integrations.map(integration => ({
            id: integration.id,
            figma_user_id: integration.figma_user_id,
            token_expiry: integration.token_expiry,
        }));
    }

    async processWebhookEvent(event: FigmaWebhookEvent): Promise<void> {
        const eventType = event.event_type;

        const supportedEventTypes = Object.values(FigmaEventTypes);
        if (!supportedEventTypes.includes(eventType as FigmaEventTypes)) {
            console.log(chalk.yellow(`⚠️  Ignoring unsupported event type ${eventType}`));
            return;
        }

        const receivedPasscode = event.passcode;

        const integrations = await db().figma_integrations.findMany({
            where: {
                figma_webhooks: {
                    some: {
                        passcode: receivedPasscode,
                    },
                },
            },
            include: {
                user: true,
            },
        });

        if (integrations.length === 0) {
            console.log(chalk.yellow(`⚠️  No integrations found with matching passcode`));
            return;
        }

        for (const integration of integrations) {
            if (eventType === FigmaEventTypes.FILE_COMMENT) {
                await handleFigmaCommentEvent(integration, event, integration.user);
            }
        }
    }
}

/**
 * Handle FILE_COMMENT webhook events
 * Comment data is included in the webhook payload
 * Note: client_meta is not included in webhook payload, so we fetch it from the comment API
 */
async function handleFigmaCommentEvent(
    integration: figma_integrations,
    webhookEvent: FigmaWebhookEvent,
    user: User,
) {
    // Extract comment_id from top level (Figma webhook structure)
    const commentId = webhookEvent.comment_id;
    const fileKey = webhookEvent.file_key;
    if (!commentId) {
        console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing comment_id`));
        console.log(chalk.yellow(`Webhook event: ${JSON.stringify(webhookEvent, null, 2)}`));
        return;
    }
    if (!fileKey) {
        console.log(chalk.yellow(`⚠️  FILE_COMMENT event missing file_key`));
        console.log(chalk.yellow(`Webhook event: ${JSON.stringify(webhookEvent, null, 2)}`));
        return;
    }
    console.log(
        chalk.blue(`📝 Processing FILE_COMMENT event for file ${fileKey}, comment ${commentId}`)
    );

    // Process the comment once per integration, to prevent duplicate processing
    try {
        await db().processed_figma_comments.create({
            data: {
                figma_integration_id: integration.id,
                comment_id: commentId,
                file_key: fileKey,
            },
        });
    } catch (error: any) {
        // Race condition - comment already being processed
        if (error.code === 'P2002') {
            console.log(chalk.blue(`ℹ️  Comment ${commentId} already being processed`));
            return;
        }
        throw error;
    }

    // Fetch comment details from Figma API to get client_meta
    // client_meta is not included in the webhook payload
    const commentThreadData = await fetchFigmaCommentThreadFromApi(
        integration.access_token,
        fileKey,
        commentId
    );
    if (!commentThreadData) {
        console.log(chalk.yellow(`⚠️  Could not fetch comment ${commentId} from API`));
        return;
    }

    const { comment: commentFromApi, thread } = commentThreadData;

    const { rootComment, positioningComment, positioningData } = resolvePositioningContext(
        commentFromApi,
        thread
    );

    console.log(
        chalk.blue(`Client Meta (event comment): ${JSON.stringify(commentFromApi.client_meta, null, 2)}`)
    );
    if (positioningComment && positioningComment.id !== commentFromApi.id) {
        console.log(
            chalk.blue(
                `Using comment ${positioningComment.id} client_meta for positioning: ${JSON.stringify(positioningComment.client_meta, null, 2)}`
            )
        );
    }
    console.log(
        chalk.blue(`📍 Positioning data for comment ${commentId}:`),
        positioningData ? JSON.stringify(positioningData, null, 2) : 'null (empty client_meta)'
    );

    // Map comment to design elements using positioning data
    let matchedNodeIds: string[] = [];
    try {
        const nodeId = positioningComment?.client_meta?.node_id ?? commentFromApi.client_meta?.node_id;
        matchedNodeIds = await mapCommentToDesignElements(
            integration.access_token,
            fileKey,
            positioningData,
            nodeId
        );
        console.log(
            chalk.blue(`🎯 Matched ${matchedNodeIds.length} node(s) for comment ${commentId}:`),
            matchedNodeIds.length > 0 ? matchedNodeIds.join(', ') : 'none'
        );
    } catch (error) {
        console.error(
            chalk.red(`Error mapping comment ${commentId} to design elements:`),
            error
        );
        // Continue with empty array if mapping fails
    }

    // Extract images for visual context
    let imageUrls: FigmaCommentImageUrls = {
        nodeImage: undefined,
        fullFrame: undefined,
    };
    try {
        imageUrls = await extractCommentImages(
            integration.access_token,
            fileKey,
            matchedNodeIds,
            positioningData
        );
        console.log(
            chalk.blue(`🖼️  Extracted images for comment ${commentId}:`),
            Object.keys(imageUrls).length > 0
                ? `${Object.keys(imageUrls).length} image(s) extracted`
                : 'no images extracted'
        );
    } catch (error) {
        console.error(
            chalk.red(`Error extracting images for comment ${commentId}:`),
            error
        );
        // Continue with empty object if image extraction fails
    }

    // Calculate image expiry (24 hours from now)
    const imageExpiry = imageUrls.nodeImage || imageUrls.fullFrame
        ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        : null;

    // Get the closest node ID for storage
    const closestNodeId = matchedNodeIds.length > 0
        ? matchedNodeIds[0]
        : (positioningComment?.client_meta?.node_id ?? commentFromApi.client_meta?.node_id ?? null);

    const fileMetadata = await fetchFileMetadata(integration.access_token, fileKey);
    if (!fileMetadata) {
        console.log(chalk.yellow(`⚠️  Could not fetch file metadata for file ${fileKey}`));
        return;
    }

    // Store enriched context for debugging
    try {
        await db().figma_comment_context.create({
            data: {
                figma_integration_id: integration.id,
                comment_id: commentId,
                file_key: fileKey,
                node_id: closestNodeId,
                comment_data: JSON.parse(JSON.stringify({
                    ...commentFromApi,
                    thread_comments: thread,
                })),
                file_metadata: fileMetadata ? JSON.parse(JSON.stringify(fileMetadata)) : null,
                positioning_data: positioningData ? JSON.parse(JSON.stringify(positioningData)) : null,
                matched_node_ids: matchedNodeIds,
                image_urls: Object.keys(imageUrls).length > 0 ? JSON.parse(JSON.stringify(imageUrls)) : null,
                image_expiry: imageExpiry,
            },
        });
        console.log(
            chalk.green(`✅ Stored enriched context for comment ${commentId}`),
            chalk.gray(`- Positioning: ${positioningData ? positioningData.type : 'none'}, Nodes: ${matchedNodeIds.length}, Images: ${Object.keys(imageUrls).length}`)
        );
    } catch (error) {
        console.error(
            chalk.red(`❌ Error storing enriched context for comment ${commentId}:`),
            error
        );
        // Don't throw - continue processing even if storage fails
    }

    const rootCommentId = rootComment?.id ?? commentFromApi.id;

    const threadEntries: FigmaCommentThreadEntry[] = thread.map((threadComment) => ({
        id: threadComment.id,
        message: threadComment.message,
        author: threadComment.user,
        createdAt: threadComment.created_at,
        resolvedAt: threadComment.resolved_at ?? null,
        parentId: threadComment.parent_id ?? null,
        orderId: threadComment.order_id,
        isRoot: threadComment.id === rootCommentId,
    }));

    const eventData: FigmaCommentEventData = {
        commentId: commentFromApi.id,
        fileKey: fileKey,
        fileUrl: `https://www.figma.com/file/${fileKey}`,
        nodeId: closestNodeId || undefined,
        message: commentFromApi.message,
        author: commentFromApi.user,
        createdAt: commentFromApi.created_at,
        resolved: Boolean(commentFromApi.resolved_at && commentFromApi.resolved_at !== ''),
        thread: threadEntries,
        fileMetadata: fileMetadata,
        positioningData: positioningData ?? undefined,
        matchedNodeIds: matchedNodeIds.length > 0 ? matchedNodeIds : undefined,
        imageUrls: Object.keys(imageUrls).length > 0 ? imageUrls : undefined,
    };
    const figmaEvent = new FigmaCommentEvent(eventData);
    const eventProcessor = new EventProcessor(figmaEvent, user);
    await eventProcessor.process();
}

// MARK: - FigmaCommentEvent

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

    matchesAutomationInput(automationInput: AutomationInputWithConfigs): boolean {
        // Check if integration type matches
        if (automationInput.integration_type !== IntegrationType.FIGMA) {
            return false;
        }

        // Require file_key to be configured and match the event's file_key
        const figmaConfig = automationInput.figma_config;
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

// MARK: - Types

/**
 * Figma webhook comment text object (from webhook payload)
 */
export interface FigmaWebhookCommentText {
  text: string;
}

/**
 * Raw Figma webhook event payload
 * Generated from actual Figma webhook payload structure
 */
export interface FigmaWebhookEvent {
  event_type: string;
  file_key: string;
  file_name: string;
  passcode: string;
  protocol_version: string;
  webhook_id: string;
  timestamp: string;
  retries: number;
  // FILE_COMMENT specific fields
  comment_id: string;
  comment: FigmaWebhookCommentText[];
  created_at: string;
  resolved_at: string; // Empty string if not resolved
  parent_id: string; // Empty string if no parent
  order_id: string;
  mentions: unknown[]; // Array of mention objects (structure unknown)
  triggered_by: FigmaWebhookUser;
}

