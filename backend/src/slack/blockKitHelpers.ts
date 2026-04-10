import type { AppMentionEvent, Button, GenericMessageEvent, KnownBlock, ModalView } from "@slack/types"
import { WebClient } from "@slack/web-api"
import { SlackAttachment, SlackBlock, SlackBlocks, SlackFile, SlackFiles, SlackTrigger } from "terse-types"

import { ConfigurationFieldDefinition, FormFieldDefinition } from "../integrations/abstract/Integration"
import logger from "../logger"
import { extractErrorMessage } from "../utility/strings"

import { SlackApprovalMessageStatus } from "./ApprovalStatus"

/**
 * Creates a section block with markdown text
 */
export function createSectionBlock(text: string, fields?: Array<{ label: string; value: string }>): KnownBlock {
    if (fields && fields.length > 0) {
        return {
            type: "section",
            fields: fields.map(field => ({
                type: "mrkdwn" as const,
                text: `*${field.label}:*\n${field.value}`
            }))
        }
    }

    return {
        type: "section",
        text: {
            type: "mrkdwn",
            text: text
        }
    }
}

/**
 * Creates a button element
 */
export function createButton(
    text: string,
    actionId: string,
    options?: {
        style?: "primary" | "danger"
        value?: string
        url?: string
    }
): Button {
    const button: Button = {
        type: "button",
        text: {
            type: "plain_text",
            text: text,
            emoji: true
        },
        action_id: actionId
    }

    if (options?.style) {
        button.style = options.style
    }

    if (options?.value) {
        button.value = options.value
    }

    if (options?.url) {
        button.url = options.url
    }

    return button
}

/**
 * Creates an actions block containing button elements
 */
export function createActionBlock(elements: Button[]): KnownBlock {
    return {
        type: "actions",
        elements: elements
    }
}

function createMetaBlock(label: string, value: string): KnownBlock {
    return createSectionBlock(`*${label}*\n${value}`)
}

function createHeaderBlock(title: string, subtitle: string): KnownBlock[] {
    return [
        {
            type: "header",
            text: {
                type: "plain_text",
                text: title
            }
        },
        createSectionBlock(subtitle),
        createDividerBlock()
    ]
}

/**
 * Creates a divider block
 */
export function createDividerBlock(): KnownBlock {
    return {
        type: "divider"
    }
}

/**
 * Creates Block Kit blocks for a survey multiple-choice question in a message.
 * Uses a section (question text) and an actions block with static_select.
 * The block_id on the actions block encodes sessionId and channel for the response handler.
 */
export function createSurveyQuestionBlocks(question: string, options: { label: string; value: string }[], blockId: string): KnownBlock[] {
    const sectionBlock: KnownBlock = {
        type: "section",
        text: {
            type: "mrkdwn",
            text: question
        }
    }
    const actionsBlock: KnownBlock = {
        type: "actions",
        block_id: blockId,
        elements: [
            {
                type: "static_select",
                action_id: "survey_select",
                placeholder: {
                    type: "plain_text",
                    text: "Select an option",
                    emoji: true
                },
                options: options.map(opt => ({
                    text: { type: "plain_text" as const, text: opt.label, emoji: true },
                    value: opt.value
                }))
            }
        ]
    }
    return [sectionBlock, actionsBlock]
}

/**
 * Creates a message with integration connection button
 */
export function createIntegrationConnectionMessage(
    integration: string,
    buttonType: "form" | "config" | "oauth",
    options: {
        stateToken?: string
        oauthUrl?: string
        actionIdPrefix?: string
    }
): KnownBlock[] {
    const blocks: KnownBlock[] = []

    let sectionText: string
    let buttonText: string
    let actionId: string

    if (buttonType === "form") {
        sectionText = `To connect *${integration}*, click the button below to fill out the integration form:`
        buttonText = `Connect ${integration}`
        actionId = options.actionIdPrefix || `open_integration_form_${integration}`
    } else if (buttonType === "config") {
        sectionText = `To connect *${integration}*, click the button below to configure the integration:`
        buttonText = `Configure ${integration}`
        actionId = options.actionIdPrefix || `open_integration_config_${integration}`
    } else {
        // oauth
        sectionText = `To connect *${integration}*, click the button below to authorize the integration:`
        buttonText = `Connect ${integration}`
        actionId = options.actionIdPrefix || `open_integration_oauth_${integration}`
    }

    blocks.push(createSectionBlock(sectionText))

    const buttonOptions: Parameters<typeof createButton>[2] = {
        style: "primary"
    }

    if (buttonType === "oauth" && options.oauthUrl) {
        buttonOptions.url = options.oauthUrl
    } else if (options.stateToken) {
        buttonOptions.value = options.stateToken
    }

    blocks.push(createActionBlock([createButton(buttonText, actionId, buttonOptions)]))

    return blocks
}

/**
 * Creates an approval message with approve/reject/request changes buttons
 */
export function createApprovalMessage(options: { agentName: string; notificationFor: string; runId: string; stepId: string; runHistoryLink?: string }): KnownBlock[] {
    const blocks: KnownBlock[] = []

    blocks.push(...createHeaderBlock("Approval Required", "Your review is required before this step can continue."))
    blocks.push(createMetaBlock("Agent", options.agentName))
    blocks.push(createMetaBlock("Notification For", options.notificationFor))

    // Action buttons
    const buttons: Button[] = [
        createButton("Approve", `approval_approve_${options.runId}__${options.stepId}`, {
            style: "primary",
            value: "approve"
        }),
        createButton("Request Changes", `approval_request_changes_${options.runId}__${options.stepId}`, {
            value: "request_changes"
        }),
        createButton("Reject", `approval_reject_${options.runId}__${options.stepId}`, {
            style: "danger",
            value: "reject"
        })
    ]

    if (options.runHistoryLink) {
        buttons.push(
            createButton("Open run to review", "view_run_history", {
                url: options.runHistoryLink
            })
        )
    }

    blocks.push(createActionBlock(buttons))

    return blocks
}

/**
 * Creates an updated approval message with status
 */
export function createUpdatedApprovalMessage(options: {
    agentName: string
    notificationFor: string
    status: SlackApprovalMessageStatus
    statusEmoji: string
    statusText: string
    runHistoryLink?: string
    rejectionReason?: string
}): KnownBlock[] {
    const blocks: KnownBlock[] = []

    blocks.push(...createHeaderBlock("Approval Updated", "This approval request has been updated."))
    blocks.push(createMetaBlock("Agent", options.agentName))
    blocks.push(createMetaBlock("Notification For", options.notificationFor))
    blocks.push(createMetaBlock("Status", `${options.statusEmoji} ${options.statusText}`))

    // Add rejection reason / feedback section if available
    if ((options.status === SlackApprovalMessageStatus.REJECTED || options.status === SlackApprovalMessageStatus.CHANGES_REQUESTED) && options.rejectionReason) {
        const feedbackLabel = options.status === SlackApprovalMessageStatus.CHANGES_REQUESTED ? "Feedback" : "Rejection Reason"
        blocks.push(createMetaBlock(feedbackLabel, options.rejectionReason))
    }

    // Add view run history button if link is available
    if (options.runHistoryLink) {
        blocks.push(
            createActionBlock([
                createButton("Open run to review", "view_run_history", {
                    url: options.runHistoryLink
                })
            ])
        )
    }

    return blocks
}

/**
 * Creates a notification message
 */
export function createNotificationMessage(options: { agentName: string; notificationFor: string; details?: string; url?: string }): KnownBlock[] {
    const blocks: KnownBlock[] = []

    blocks.push(...createHeaderBlock("Notification", "A quick update from your agent."))
    blocks.push(createMetaBlock("Agent", options.agentName))
    blocks.push(createMetaBlock("Notification For", options.notificationFor))

    // Details if provided
    if (options.details) {
        blocks.push(createSectionBlock(options.details))
    }

    // View button if URL provided
    if (options.url) {
        blocks.push(
            createActionBlock([
                createButton("Open details", "view_action", {
                    url: options.url
                })
            ])
        )
    }

    return blocks
}

/**
 * Creates a run failure notification message.
 */
export function createRunFailureNotificationMessage(options: { agentName: string; errorSummary: string; runHistoryLink?: string }): KnownBlock[] {
    const blocks: KnownBlock[] = []

    blocks.push(...createHeaderBlock("Run Failed", "This run ended with an error and needs attention."))
    blocks.push(createMetaBlock("Agent", options.agentName))
    blocks.push(createMetaBlock("Notification For", "A run failed."))
    blocks.push(createMetaBlock("Error", options.errorSummary))

    if (options.runHistoryLink) {
        blocks.push(
            createActionBlock([
                createButton("Open run history", "view_run_history", {
                    url: options.runHistoryLink
                })
            ])
        )
    }

    return blocks
}

/**
 * Creates a feedback modal view
 */
export function createFeedbackModal(options: { title: string; submitText: string; cancelText: string; privateMetadata: string; blockId?: string; actionId?: string; placeholder?: string }): ModalView {
    return {
        type: "modal",
        title: {
            type: "plain_text",
            text: options.title
        },
        submit: {
            type: "plain_text",
            text: options.submitText
        },
        close: {
            type: "plain_text",
            text: options.cancelText
        },
        private_metadata: options.privateMetadata,
        blocks: [
            createSectionBlock("Please provide feedback on what changes you would like the agent to make."),
            {
                type: "input",
                block_id: options.blockId || "feedback_block",
                element: {
                    type: "plain_text_input",
                    action_id: options.actionId || "feedback",
                    multiline: true,
                    placeholder: {
                        type: "plain_text",
                        text: options.placeholder || "Enter your feedback..."
                    }
                },
                label: {
                    type: "plain_text",
                    text: "Feedback"
                }
            }
        ]
    }
}

/**
 * Creates a form modal view
 */
export function createFormModal(options: { title: string; submitText: string; cancelText: string; privateMetadata: string; blocks: KnownBlock[] }): ModalView {
    return {
        type: "modal",
        title: {
            type: "plain_text",
            text: options.title
        },
        submit: {
            type: "plain_text",
            text: options.submitText
        },
        close: {
            type: "plain_text",
            text: options.cancelText
        },
        private_metadata: options.privateMetadata,
        blocks: options.blocks
    }
}

/**
 * Creates an OAuth modal view
 */
export function createOAuthModal(options: { integrationType: string; oauthUrl: string; backButtonMetadata: string }): ModalView {
    return {
        type: "modal",
        title: {
            type: "plain_text",
            text: `Connect ${options.integrationType}`
        },
        close: {
            type: "plain_text",
            text: "Close"
        },
        private_metadata: options.backButtonMetadata,
        blocks: [
            createSectionBlock("Click the button below to authorize the integration:"),
            createActionBlock([
                createButton(`Connect ${options.integrationType}`, `oauth_connect_${options.integrationType}`, {
                    url: options.oauthUrl,
                    style: "primary"
                })
            ]),
            createActionBlock([createButton("Back", `back_to_config_${options.integrationType}`)])
        ]
    }
}

/**
 * Creates a processing state modal view
 */
export function createProcessingModal(options: { integrationType: string; privateMetadata: string }): ModalView {
    return {
        type: "modal",
        title: {
            type: "plain_text",
            text: `Connecting ${options.integrationType}`
        },
        close: {
            type: "plain_text",
            text: "Close"
        },
        private_metadata: options.privateMetadata,
        blocks: [createSectionBlock("⏳ Processing your request...")]
    }
}

/**
 * Creates a success state modal view
 */
export function createSuccessModal(options: { integrationType: string; privateMetadata: string }): ModalView {
    return {
        type: "modal",
        title: {
            type: "plain_text",
            text: `✅ ${options.integrationType} Connected`
        },
        close: {
            type: "plain_text",
            text: "Close"
        },
        private_metadata: options.privateMetadata,
        blocks: [createSectionBlock(`✅ Your ${options.integrationType} integration has been successfully connected!`), createSectionBlock("You can now close this window.")]
    }
}

/**
 * Creates an error state modal view
 */
export function createErrorModal(options: { integrationType: string; errorMessage: string; privateMetadata: string }): ModalView {
    return {
        type: "modal",
        title: {
            type: "plain_text",
            text: `❌ Connection Failed`
        },
        close: {
            type: "plain_text",
            text: "Close"
        },
        private_metadata: options.privateMetadata,
        blocks: [
            createSectionBlock(`❌ Failed to connect ${options.integrationType}`),
            createSectionBlock(`*Error:* ${options.errorMessage}`),
            createSectionBlock("Please check your credentials and try again.")
        ]
    }
}

/**
 * Convert FormFieldDefinition array to Slack Block Kit input blocks
 */
export function formFieldsToSlackBlocks(formFields: FormFieldDefinition[]): KnownBlock[] {
    const blocks: KnownBlock[] = []

    for (const field of formFields) {
        const block: any = {
            type: "input",
            block_id: `${field.name}_block`,
            label: {
                type: "plain_text",
                text: field.label
            },
            element: {
                type: "plain_text_input",
                action_id: field.name
            }
        }

        // Set multiline for textarea fields
        // Note: Slack doesn't support password fields natively, so password fields
        // are treated as regular text inputs (the application handles security)
        if (field.type === "textarea") {
            block.element.multiline = true
        }

        // Add placeholder if provided
        if (field.placeholder) {
            block.element.placeholder = {
                type: "plain_text",
                text: field.placeholder
            }
        }

        // Add hint if provided
        if (field.hint) {
            block.hint = {
                type: "plain_text",
                text: field.hint
            }
        }

        blocks.push(block)
    }

    return blocks
}

/**
 * Convert ConfigurationFieldDefinition array to Slack Block Kit input blocks
 */
export function configurationFieldsToSlackBlocks(configFields: ConfigurationFieldDefinition[]): KnownBlock[] {
    const blocks: KnownBlock[] = []

    for (const field of configFields) {
        if (field.type === "radio") {
            const block: any = {
                type: "input",
                block_id: `${field.name}_block`,
                label: {
                    type: "plain_text",
                    text: field.label
                },
                element: {
                    type: "radio_buttons",
                    action_id: field.name,
                    options: field.options.map(opt => ({
                        value: opt.value,
                        text: {
                            type: "plain_text",
                            text: opt.label
                        }
                    }))
                }
            }

            // Add hint if provided
            if (field.hint) {
                block.hint = {
                    type: "plain_text",
                    text: field.hint
                }
            }

            blocks.push(block)
        } else if (field.type === "select") {
            // Future: implement select field support
            // For now, skip select fields or throw error
            logger.warn("Select fields in configuration are not yet supported", { field })
        }
    }

    return blocks
}

// =============================================================================
// TEXT EXTRACTION FROM BLOCKS AND ATTACHMENTS
// =============================================================================

/**
 * Represents an image extracted from a Slack message
 * Can be from blocks, attachments, or file uploads
 */
export interface SlackMessageImage {
    url: string
    alt_text?: string
    title?: string
    source: "block" | "attachment" | "file"
    // For files, we need auth to access
    requiresAuth: boolean
}

// =============================================================================
// IMAGE EXTRACTION
// =============================================================================

/**
 * Extract all images from a Slack message
 * Searches blocks, attachments, and files for images
 */
export function extractImagesFromMessage(event: SlackTrigger): SlackMessageImage[] {
    const images: SlackMessageImage[] = []

    // Extract from blocks
    if (event.blocks) {
        images.push(...extractImagesFromBlocks(event.blocks))
    }

    // Extract from attachments
    if (event.attachments) {
        images.push(...extractImagesFromAttachments(event.attachments))
    }

    // Extract from files
    if (event.files) {
        images.push(...extractImagesFromFiles(event.files))
    }

    return images
}

/**
 * Extract images from Block Kit blocks
 * Handles: image blocks, section accessories, context elements
 */
function extractImagesFromBlocks(blocks: SlackBlock[]): SlackMessageImage[] {
    const images: SlackMessageImage[] = []

    for (const block of blocks) {
        // Image block
        if (block.type === "image") {
            const imageUrl = (block as any).image_url || (block as any).url
            if (imageUrl) {
                images.push({
                    url: imageUrl,
                    alt_text: block.alt_text,
                    title: block.title?.text,
                    source: "block",
                    requiresAuth: false
                })
            }
        }

        // Section block with image accessory
        if (block.type === "section" && block.accessory?.type === "image") {
            const accessory = block.accessory as any
            const imageUrl = accessory.image_url || accessory.url
            if (imageUrl) {
                images.push({
                    url: imageUrl,
                    alt_text: accessory.alt_text,
                    source: "block",
                    requiresAuth: false
                })
            }
        }

        // Context block with image elements
        if (block.type === "context" && block.elements) {
            for (const element of block.elements) {
                if (element.type === "image") {
                    const imgElement = element as any
                    const imageUrl = imgElement.image_url || imgElement.url
                    if (imageUrl) {
                        images.push({
                            url: imageUrl,
                            alt_text: imgElement.alt_text,
                            source: "block",
                            requiresAuth: false
                        })
                    }
                }
            }
        }
    }

    return images
}

/**
 * Extract images from legacy attachments
 */
function extractImagesFromAttachments(attachments: SlackAttachment[]): SlackMessageImage[] {
    const images: SlackMessageImage[] = []

    for (const attachment of attachments) {
        // Main image in attachment
        if (attachment.image_url) {
            images.push({
                url: attachment.image_url,
                alt_text: attachment.title || attachment.fallback,
                source: "attachment",
                requiresAuth: false
            })
        }
        // Thumbnail image (use if no main image, or as fallback)
        else if (attachment.thumb_url) {
            images.push({
                url: attachment.thumb_url,
                alt_text: attachment.title || attachment.fallback,
                source: "attachment",
                requiresAuth: false
            })
        }
    }

    return images
}

/**
 * Get the best available URL for a Slack file.
 * Prefers url_private (full resolution), then falls back through thumbnail sizes.
 */
export function pickSlackFileUrl(file: SlackFile): string | undefined {
    return file.url_private || file.thumb_1024 || file.thumb_960 || file.thumb_800 || file.thumb_720 || file.thumb_480 || file.thumb_360
}

/**
 * Extract images from file uploads
 * Note: Slack file URLs require authentication to access
 */
function extractImagesFromFiles(files: SlackFiles): SlackMessageImage[] {
    const images: SlackMessageImage[] = []
    const imageMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml"]
    const imageFileTypes = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]

    if (!files) return images
    for (const file of files) {
        // Check if it's an image file
        const isImage = (file.mimetype && imageMimeTypes.includes(file.mimetype)) || (file.filetype && imageFileTypes.includes(file.filetype.toLowerCase()))

        if (!isImage) continue

        const url = pickSlackFileUrl(file)

        if (url) {
            images.push({
                url: url,
                alt_text: file.title || file.name || undefined,
                title: file.title || undefined,
                source: "file",
                // Slack file URLs require authentication
                requiresAuth: true
            })
        }
    }

    return images
}

export async function addEyesReaction(client: WebClient, messageEvent: AppMentionEvent | GenericMessageEvent) {
    try {
        await client.reactions.add({
            channel: messageEvent.channel,
            timestamp: messageEvent.ts,
            name: "eyes"
        })
    } catch (error) {
        logger.error("Error adding reaction to thread message:", { error })
    }
}

export async function removeEyesReaction(client: WebClient, messageEvent: AppMentionEvent | GenericMessageEvent) {
    try {
        await client.reactions.remove({
            channel: messageEvent.channel,
            timestamp: messageEvent.ts,
            name: "eyes"
        })
    } catch (error: unknown) {
        const message = extractErrorMessage(error)
        if (message.includes("no_reaction")) {
            return
        }
        logger.error("Error removing reaction from thread message:", { error })
    }
}
