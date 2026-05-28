import * as z from "zod"

import { EntityType } from "./Entities"
import { sdkJobServerCheckStepSchema } from "./types"

export const entityTypeSchema = z.enum(EntityType)

export enum ChangeEventType {
    CREATED = "CREATED",
    UPDATED = "UPDATED",
    ACTION_EXECUTED = "ACTION_EXECUTED"
}

const modelEventBaseSchema = z.object({
    id: z.string(),
    timestamp: z.number(),
    response_id: z.string()
})

export const changeEventTypeSchema = z.enum(ChangeEventType)

export const sharedErrorContextSchema = z.object({
    error: z.unknown()
})
export type SharedErrorContext = z.infer<typeof sharedErrorContextSchema>

export const changedItemSchema = z.object({
    type_name: entityTypeSchema,
    id: z.string(),
    change_event_type: changeEventTypeSchema
})
export type ChangedItem = z.infer<typeof changedItemSchema>

export const runErrorSchema = modelEventBaseSchema.extend({
    type: z.literal("RunError"),
    error: z.string(),
    code: z.string().optional()
})
export type RunError = z.infer<typeof runErrorSchema>

export const processOutputSchema = modelEventBaseSchema.extend({
    type: z.literal("ProcessOutput"),
    stream: z.enum(["stdout", "stderr"]),
    content: z.string(),
    label: z.string()
})
export type ProcessOutput = z.infer<typeof processOutputSchema>

export const cancelledSchema = modelEventBaseSchema.extend({
    type: z.literal("Cancelled"),
    reason: z.string().optional()
})
export type Cancelled = z.infer<typeof cancelledSchema>

export const naturalStopSchema = modelEventBaseSchema.extend({
    type: z.literal("NaturalStop")
})
export type NaturalStop = z.infer<typeof naturalStopSchema>

export const sendModelRequestSchema = z.object({
    type: z.literal("SendModelRequest"),
    id: z.string().optional(),
    user_message: z.string(),
    timezone: z.string(),
    ui_state: z.string().optional(),
    client_turn_id: z.string(),
    template_id: z.string().optional()
})
export type SendModelRequest = z.infer<typeof sendModelRequestSchema>

export const toolApprovalResponseSchema = modelEventBaseSchema.extend({
    approved: z.boolean(),
    rejection_reason: z.string().optional(),
    type: z.literal("ToolApprovalResponse")
})
export type ToolApprovalResponse = z.infer<typeof toolApprovalResponseSchema>

export const toolApprovalRequestSchema = modelEventBaseSchema.extend({
    name: z.string(),
    arguments: z.string(),
    type: z.literal("ToolApprovalRequest")
})
export type ToolApprovalRequest = z.infer<typeof toolApprovalRequestSchema>

export const textDeltaSchema = modelEventBaseSchema.extend({
    delta: z.string(),
    type: z.literal("TextDelta")
})
export type TextDelta = z.infer<typeof textDeltaSchema>

export const toolCallSchema = modelEventBaseSchema.extend({
    summary: z.string(),
    parameters: z.string(),
    integration: z.string(),
    type: z.literal("ToolCall")
})
export type ToolCall = z.infer<typeof toolCallSchema>

export const thinkingSchema = modelEventBaseSchema.extend({
    type: z.literal("Thinking")
})
export type Thinking = z.infer<typeof thinkingSchema>

export enum ToolCallExecutionStatus {
    COMPLETED = "completed",
    INCOMPLETE = "incomplete",
    FAILED = "failed",
    UNKNOWN = "unknown"
}

export const toolCallExecutionStatusSchema = z.enum(ToolCallExecutionStatus)

export const toolCallCompleteSchema = modelEventBaseSchema.extend({
    tool_name: z.string(),
    status: toolCallExecutionStatusSchema,
    type: z.literal("ToolCallComplete"),
    changed_items: z.array(changedItemSchema),
    integration: z.string(),
    url: z.string().optional(),
    result: z.string().optional(),
    errorContext: sharedErrorContextSchema.optional()
})
export type ToolCallComplete = z.infer<typeof toolCallCompleteSchema>

export const userMessageSchema = modelEventBaseSchema.extend({
    type: z.literal("UserMessage"),
    message: z.string(),
    client_turn_id: z.string()
})
export type UserMessage = z.infer<typeof userMessageSchema>

export const multipleChoiceOptionSchema = z.object({
    label: z.string(),
    value: z.string()
})

export const buttonSchema = z.object({
    type: z.literal("button"),
    label: z.string(),
    url: z.string()
})

export const integrationPromptSchema = z.object({
    type: z.literal("integration_prompt"),
    integration: z.string(),
    message: z.string(),
    stateToken: z.string().optional()
})

export const navigateSchema = z.object({
    type: z.literal("navigate"),
    path: z.string()
})

export const multipleChoiceSchema = z.object({
    type: z.literal("multiple_choice"),
    questionId: z.string(),
    question: z.string(),
    options: z.array(multipleChoiceOptionSchema),
    allowMultiple: z.boolean().optional()
})

export const imageSchema = z.object({
    type: z.literal("image"),
    url: z.string()
})

export const webhookFailureStageSchema = z.enum(["handshake", "delivery"])
export type WebhookFailureStage = z.infer<typeof webhookFailureStageSchema>

/**
 * Surfaced in the run history drawer when a self-hosted SDK job fails to reach (or be accepted by)
 * the customer's webhook server. Persisted as a snippet so the failure is visible in the timeline
 * alongside other run events; the run row itself is still marked FAILED.
 */
export const webhookFailureSchema = z.object({
    type: z.literal("webhook_failure"),
    stage: webhookFailureStageSchema,
    message: z.string(),
    triggerUrl: z.string(),
    step: sdkJobServerCheckStepSchema.optional(),
    httpStatus: z.number().optional(),
    bodySnippet: z.string().optional()
})

export const snippetVariantSchema = z.discriminatedUnion("type", [buttonSchema, integrationPromptSchema, navigateSchema, multipleChoiceSchema, imageSchema, webhookFailureSchema])
export type SnippetVariant = z.infer<typeof snippetVariantSchema>

const chatSnippetMetadataSchema = {
    id: z.string().optional(),
    selectedValue: z.string().optional()
} satisfies z.ZodRawShape

export const chatSnippetSchema = z.discriminatedUnion("type", [
    buttonSchema.extend(chatSnippetMetadataSchema),
    integrationPromptSchema.extend(chatSnippetMetadataSchema),
    navigateSchema.extend(chatSnippetMetadataSchema),
    multipleChoiceSchema.extend(chatSnippetMetadataSchema),
    imageSchema.extend(chatSnippetMetadataSchema),
    webhookFailureSchema.extend(chatSnippetMetadataSchema)
])
export type ChatSnippet = z.infer<typeof chatSnippetSchema>

export const modelEventChatSnippetSchema = modelEventBaseSchema.extend({
    type: z.literal("Snippet"),
    snippet: chatSnippetSchema
})

export const modelEventSchema = z.discriminatedUnion("type", [
    toolApprovalResponseSchema,
    toolApprovalRequestSchema,
    toolCallSchema,
    toolCallCompleteSchema,
    textDeltaSchema,
    runErrorSchema,
    cancelledSchema,
    naturalStopSchema,
    userMessageSchema,
    thinkingSchema,
    modelEventChatSnippetSchema,
    processOutputSchema
])
export type ModelEvent = z.infer<typeof modelEventSchema>

export const modelRequestSchema = z.discriminatedUnion("type", [sendModelRequestSchema, toolApprovalResponseSchema])
export type ModelRequest = z.infer<typeof modelRequestSchema>
