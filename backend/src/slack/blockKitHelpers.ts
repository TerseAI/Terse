import type { AppMentionEvent, Button, GenericMessageEvent, KnownBlock, ModalView, RichTextElement, TextObject } from "@slack/types"
import { WebClient } from "@slack/web-api"

import { ConfigurationFieldDefinition, FormFieldDefinition } from "../integrations/abstract/Integration"
import logger from "../logger"

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
export function createApprovalMessage(options: { channelName: string; summary: string; runId: string; stepId: string; runHistoryLink?: string }): KnownBlock[] {
    const blocks: KnownBlock[] = []

    // Header section
    const headerText = options.runHistoryLink
        ? `You have a new approval request:\n*<${options.runHistoryLink}|${options.channelName} - Action pending approval>*`
        : `You have a new approval request:\n*${options.channelName} - Action pending approval*`

    blocks.push(createSectionBlock(headerText))

    // Details section with fields
    blocks.push(
        createSectionBlock("", [
            {
                label: "Channel",
                value: options.channelName
            },
            {
                label: "Status",
                value: ":clock1: Pending approval"
            },
            {
                label: "Action",
                value: options.summary
            }
        ])
    )

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
            createButton("View Details", "view_run_history", {
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
    channelName: string
    summary: string
    status: "approved" | "rejected" | "changes_requested" | "processing" | "failed"
    statusEmoji: string
    statusText: string
    runHistoryLink?: string
    rejectionReason?: string
}): KnownBlock[] {
    const blocks: KnownBlock[] = []

    // Determine status message
    let statusMessage: string
    if (options.status === "approved") {
        statusMessage = "approved"
    } else if (options.status === "rejected") {
        statusMessage = "rejected"
    } else if (options.status === "changes_requested") {
        statusMessage = "has changes requested"
    } else if (options.status === "failed") {
        statusMessage = "failed"
    } else {
        statusMessage = "is being processed"
    }

    // Header section
    const headerText = options.runHistoryLink
        ? `Approval request ${statusMessage}:\n*<${options.runHistoryLink}|${options.channelName} - ${options.statusText}>*`
        : `Approval request ${statusMessage}:\n*${options.channelName} - ${options.statusText}*`

    blocks.push(createSectionBlock(headerText))

    // Details section with fields
    blocks.push(
        createSectionBlock("", [
            {
                label: "Channel",
                value: options.channelName
            },
            {
                label: "Status",
                value: `${options.statusEmoji} ${options.statusText}`
            },
            {
                label: "Action",
                value: options.summary
            }
        ])
    )

    // Add rejection reason / feedback section if available
    if ((options.status === "rejected" || options.status === "changes_requested") && options.rejectionReason) {
        const feedbackLabel = options.status === "changes_requested" ? "Feedback" : "Rejection Reason"
        blocks.push(createSectionBlock(`*${feedbackLabel}:*\n${options.rejectionReason}`))
    }

    // Add view run history button if link is available
    if (options.runHistoryLink) {
        blocks.push(
            createActionBlock([
                createButton("View Run History", "view_run_history", {
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
export function createNotificationMessage(options: { action: string; target: string; emoji: string; details?: string; url?: string }): KnownBlock[] {
    const blocks: KnownBlock[] = []

    // Main notification text
    blocks.push(createSectionBlock(`*${options.action}* - ${options.emoji} ${options.target}`))

    // Details if provided
    if (options.details) {
        blocks.push(createSectionBlock(options.details))
    }

    // View button if URL provided
    if (options.url) {
        blocks.push(
            createActionBlock([
                createButton("View", "view_action", {
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
export function createRunFailureNotificationMessage(options: {
    agentName: string
    runId: string
    errorSummary: string
    runHistoryLink?: string
}): KnownBlock[] {
    const blocks: KnownBlock[] = []

    const headerText = options.runHistoryLink
        ? `:x: *Run failed* in *<${options.runHistoryLink}|${options.agentName}>*`
        : `:x: *Run failed* in *${options.agentName}*`
    blocks.push(createSectionBlock(headerText))

    blocks.push(
        createSectionBlock("", [
            { label: "Agent", value: options.agentName },
            { label: "Status", value: ":x: Failed" },
            { label: "Run ID", value: `\`${options.runId}\`` },
            { label: "Error", value: options.errorSummary }
        ])
    )

    if (options.runHistoryLink) {
        blocks.push(
            createActionBlock([
                createButton("Open Run History", "view_run_history", {
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
 * Slack attachment (legacy rich message format)
 */
export interface SlackAttachment {
    fallback?: string
    color?: string
    pretext?: string
    author_name?: string
    author_link?: string
    author_icon?: string
    title?: string
    title_link?: string
    text?: string
    fields?: Array<{
        title: string
        value: string
        short: boolean
    }>
    image_url?: string
    thumb_url?: string
    footer?: string
    footer_icon?: string
    ts?: number
}

/**
 * Slack file object from the files array in messages
 */
export interface SlackFile {
    id: string
    name?: string
    title?: string
    mimetype?: string
    filetype?: string
    // Various URL formats for accessing the file
    url_private?: string
    url_private_download?: string
    thumb_64?: string
    thumb_80?: string
    thumb_160?: string
    thumb_360?: string
    thumb_480?: string
    thumb_720?: string
    thumb_800?: string
    thumb_960?: string
    thumb_1024?: string
    // For images
    original_w?: number
    original_h?: number
}

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

/**
 * Extract readable text from Slack Block Kit blocks
 * Handles section, header, context, rich_text, and divider blocks
 */
export function extractTextFromBlocks(blocks: KnownBlock[]): string {
    if (!blocks || blocks.length === 0) {
        return ""
    }

    const textParts: string[] = []

    for (const block of blocks) {
        const blockText = extractTextFromBlock(block)
        if (blockText) {
            textParts.push(blockText)
        }
    }

    return textParts.join("\n")
}

/**
 * Extract text from a single Slack block
 */
function extractTextFromBlock(block: KnownBlock): string {
    switch (block.type) {
        case "section":
            return extractTextFromSectionBlock(block)
        case "header":
            return extractTextFromHeaderBlock(block)
        case "context":
            return extractTextFromContextBlock(block)
        case "rich_text":
            return extractTextFromRichTextBlock(block)
        case "actions":
            return extractTextFromActionsBlock(block)
        case "image":
            return extractTextFromImageBlock(block)
        case "input":
            return extractTextFromInputBlock(block)
        case "context_actions":
            return extractTextFromContextActionsBlock(block)
        case "divider":
            return "---"
        default:
            // For unknown block types, try to extract any text property
            if ("text" in block && block.text) {
                if (typeof block.text === "string") {
                    return block.text
                }
                return extractTextFromTextObject(block.text as TextObject)
            }
            return ""
    }
}

/**
 * Extract text from an actions block (buttons, checkboxes, radio buttons, etc.)
 * Focuses on meaningful content like button labels and checkbox/radio options
 */
function extractTextFromActionsBlock(block: KnownBlock): string {
    if (block.type !== "actions" || !block.elements || block.elements.length === 0) {
        return ""
    }

    const parts: string[] = []

    for (const element of block.elements) {
        const text = extractTextFromActionElement(element)
        if (text) {
            parts.push(text)
        }
    }

    return parts.join("\n")
}

/**
 * Extract meaningful text from action elements
 * Prioritizes content that conveys meaning (button labels, checkbox options)
 * over generic UI placeholders
 */
function extractTextFromActionElement(element: any): string {
    switch (element.type) {
        case "button":
            // Button text is meaningful - "Approve", "Submit", "Cancel"
            if (element.text) {
                return extractTextFromTextObject(element.text)
            }
            return ""

        case "checkboxes":
        case "radio_buttons":
            // Option labels are meaningful content
            if (element.options && Array.isArray(element.options)) {
                const optionTexts = element.options
                    .map((opt: any) => {
                        const parts: string[] = []
                        if (opt.text?.text) {
                            parts.push(opt.text.text)
                        }
                        if (opt.description?.text) {
                            parts.push(`(${opt.description.text})`)
                        }
                        return parts.join(" ")
                    })
                    .filter(Boolean)
                return optionTexts.length > 0 ? `[Options: ${optionTexts.join(", ")}]` : ""
            }
            return ""

        case "static_select":
        case "multi_static_select":
            // Static select options might be meaningful in some contexts
            if (element.options && Array.isArray(element.options)) {
                const optionTexts = element.options.map((opt: any) => opt.text?.text).filter(Boolean)
                return optionTexts.length > 0 ? `[Options: ${optionTexts.join(", ")}]` : ""
            }
            return ""

        case "overflow":
            // Overflow menu options
            if (element.options && Array.isArray(element.options)) {
                const optionTexts = element.options.map((opt: any) => opt.text?.text).filter(Boolean)
                return optionTexts.length > 0 ? `[Menu: ${optionTexts.join(", ")}]` : ""
            }
            return ""

        // Skip these - just generic UI placeholders with no meaningful content
        case "users_select":
        case "multi_users_select":
        case "conversations_select":
        case "multi_conversations_select":
        case "channels_select":
        case "multi_channels_select":
        case "external_select":
        case "multi_external_select":
        case "datepicker":
        case "timepicker":
        case "datetimepicker":
            return ""

        default:
            return ""
    }
}

/**
 * Extract text from an image block
 * Extracts title (meaningful) and alt_text (sometimes meaningful)
 */
function extractTextFromImageBlock(block: KnownBlock): string {
    if (block.type !== "image") {
        return ""
    }

    const parts: string[] = []

    // Title is usually meaningful (e.g., "I love tacos")
    if (block.title) {
        parts.push(extractTextFromTextObject(block.title))
    }

    // Alt text can be meaningful in some cases
    if (block.alt_text) {
        parts.push(`[Image: ${block.alt_text}]`)
    }

    return parts.join("\n")
}

/**
 * Extract text from an input block
 * Extracts the label and any meaningful options from the input element
 */
function extractTextFromInputBlock(block: KnownBlock): string {
    if (block.type !== "input") {
        return ""
    }

    const parts: string[] = []

    // Label tells you what the input is for (e.g., "Email Address", "Select your department")
    if (block.label) {
        parts.push(extractTextFromTextObject(block.label))
    }

    // Extract meaningful content from the input element
    if (block.element) {
        const elementText = extractTextFromActionElement(block.element)
        if (elementText) {
            parts.push(elementText)
        }
    }

    return parts.join(": ")
}

/**
 * Extract text from a context_actions block
 * These typically contain feedback buttons and other action elements
 */
function extractTextFromContextActionsBlock(block: KnownBlock): string {
    if (block.type !== "context_actions" || !block.elements || block.elements.length === 0) {
        return ""
    }

    const parts: string[] = []

    for (const element of block.elements) {
        if (element.type === "feedback_buttons") {
            // Extract text from positive/negative buttons
            const feedbackParts: string[] = []
            if ((element as any).positive_button?.text?.text) {
                feedbackParts.push((element as any).positive_button.text.text)
            }
            if ((element as any).negative_button?.text?.text) {
                feedbackParts.push((element as any).negative_button.text.text)
            }
            if (feedbackParts.length > 0) {
                parts.push(`[Feedback: ${feedbackParts.join(" / ")}]`)
            }
        } else if (element.type === "icon_button") {
            // Extract button text
            if (element.text) {
                const text = typeof element.text === "string" ? element.text : (element.text as TextObject)?.text || ""
                if (text) {
                    parts.push(text)
                }
            }
        }
    }

    return parts.join("\n")
}

/**
 * Extract text from a section block (can have text and/or fields)
 */
function extractTextFromSectionBlock(block: KnownBlock): string {
    if (block.type !== "section") {
        return ""
    }

    const parts: string[] = []

    if (block.text) {
        parts.push(extractTextFromTextObject(block.text))
    }

    if (block.fields && block.fields.length > 0) {
        for (const field of block.fields) {
            parts.push(extractTextFromTextObject(field))
        }
    }

    return parts.join("\n")
}

/**
 * Extract text from a header block
 */
function extractTextFromHeaderBlock(block: KnownBlock): string {
    if (block.type !== "header" || !block.text) {
        return ""
    }

    return `**${extractTextFromTextObject(block.text)}**`
}

/**
 * Extract text from a context block (usually metadata/footnotes)
 */
function extractTextFromContextBlock(block: KnownBlock): string {
    if (block.type !== "context" || !block.elements || block.elements.length === 0) {
        return ""
    }

    const parts: string[] = []
    for (const element of block.elements) {
        if (element.type === "mrkdwn" || element.type === "plain_text") {
            const elem = element as any
            const text = typeof elem.text === "string" ? elem.text : elem.text?.text || ""
            if (text) {
                parts.push(text)
            }
        } else if (element.type === "image") {
            // Skip images in context
        }
    }

    return parts.length > 0 ? `[${parts.join(" | ")}]` : ""
}

/**
 * Extract text from a rich_text block (complex formatted text)
 */
function extractTextFromRichTextBlock(block: KnownBlock): string {
    if (block.type !== "rich_text" || !block.elements || block.elements.length === 0) {
        return ""
    }

    const parts: string[] = []
    for (const element of block.elements) {
        const text = extractTextFromRichTextElement(element)
        if (text) {
            parts.push(text)
        }
    }

    return parts.join("\n")
}

/**
 * Recursively extract text from rich_text elements
 */
function extractTextFromRichTextElement(element: any): string {
    switch (element.type) {
        case "rich_text_section":
        case "rich_text_preformatted":
        case "rich_text_quote":
            if ("elements" in element && element.elements) {
                return element.elements.map((el: any) => extractTextFromRichTextSubElement(el)).join("")
            }
            return ""
        case "rich_text_list":
            if ("elements" in element && element.elements) {
                return element.elements.map((el: any, i: number) => `• ${extractTextFromRichTextElement(el)}`).join("\n")
            }
            return ""
        default:
            return ""
    }
}

/**
 * Extract text from rich_text sub-elements (text, link, emoji, etc.)
 */
function extractTextFromRichTextSubElement(element: RichTextElement): string {
    switch (element.type) {
        case "text":
            return (element as any).text || ""
        case "link":
            return (element as any).url || ""
        case "emoji":
            return (element as any).name ? `:${(element as any).name}:` : ""
        case "user":
            return "@user"
        case "channel":
            return "#channel"
        default:
            return ""
    }
}

/**
 * Extract text from a Slack text object (mrkdwn or plain_text)
 */
function extractTextFromTextObject(textObj: TextObject): string {
    return textObj.text || ""
}

/**
 * Extract readable text from Slack attachments (legacy format)
 * Many third-party apps still use attachments for rich content
 */
export function extractTextFromAttachments(attachments: SlackAttachment[]): string {
    if (!attachments || attachments.length === 0) {
        return ""
    }

    const textParts: string[] = []

    for (const attachment of attachments) {
        const attachmentParts: string[] = []

        // Add pretext if present
        if (attachment.pretext) {
            attachmentParts.push(attachment.pretext)
        }

        // Add author if present
        if (attachment.author_name) {
            attachmentParts.push(`Author: ${attachment.author_name}`)
        }

        // Add title (often the main content identifier)
        if (attachment.title) {
            const titleText = attachment.title_link ? `${attachment.title} (${attachment.title_link})` : attachment.title
            attachmentParts.push(titleText)
        }

        // Add main text content
        if (attachment.text) {
            attachmentParts.push(attachment.text)
        }

        // Add fields (key-value pairs)
        if (attachment.fields && attachment.fields.length > 0) {
            for (const field of attachment.fields) {
                attachmentParts.push(`${field.title}: ${field.value}`)
            }
        }

        // Add footer if present
        if (attachment.footer) {
            attachmentParts.push(`[${attachment.footer}]`)
        }

        // Use fallback if no other content was extracted
        if (attachmentParts.length === 0 && attachment.fallback) {
            attachmentParts.push(attachment.fallback)
        }

        if (attachmentParts.length > 0) {
            textParts.push(attachmentParts.join("\n"))
        }
    }

    return textParts.join("\n---\n")
}

// =============================================================================
// IMAGE EXTRACTION
// =============================================================================

/**
 * Extract all images from a Slack message
 * Searches blocks, attachments, and files for images
 */
export function extractImagesFromMessage(data: { blocks?: KnownBlock[]; attachments?: SlackAttachment[]; files?: SlackFile[] }): SlackMessageImage[] {
    const images: SlackMessageImage[] = []

    // Extract from blocks
    if (data.blocks) {
        images.push(...extractImagesFromBlocks(data.blocks))
    }

    // Extract from attachments
    if (data.attachments) {
        images.push(...extractImagesFromAttachments(data.attachments))
    }

    // Extract from files
    if (data.files) {
        images.push(...extractImagesFromFiles(data.files))
    }

    return images
}

/**
 * Extract images from Block Kit blocks
 * Handles: image blocks, section accessories, context elements
 */
function extractImagesFromBlocks(blocks: KnownBlock[]): SlackMessageImage[] {
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
function extractImagesFromFiles(files: SlackFile[]): SlackMessageImage[] {
    const images: SlackMessageImage[] = []
    const imageMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp", "image/svg+xml"]
    const imageFileTypes = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"]

    for (const file of files) {
        // Check if it's an image file
        const isImage = (file.mimetype && imageMimeTypes.includes(file.mimetype)) || (file.filetype && imageFileTypes.includes(file.filetype.toLowerCase()))

        if (!isImage) continue

        const url = pickSlackFileUrl(file)

        if (url) {
            images.push({
                url: url,
                alt_text: file.title || file.name,
                title: file.title,
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
        const message = error instanceof Error ? error.message : String(error)
        if (message.includes("no_reaction")) {
            return
        }
        logger.error("Error removing reaction from thread message:", { error })
    }
}
