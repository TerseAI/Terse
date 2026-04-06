import * as z from "zod"

import { EntityType } from "./Entities"
import type { MultipleChoiceOption } from "./Survey"

export const entityTypeSchema = z.enum(EntityType)

export enum ChangeEventType {
    CREATED = "CREATED",
    UPDATED = "UPDATED",
    ACTION_EXECUTED = "ACTION_EXECUTED"
}

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

export const runErrorSchema = z.object({
    error: z.string(),
    code: z.string().optional(),
    timestamp: z.number()
})
export type RunError = z.infer<typeof runErrorSchema>

export const cancelledSchema = z.object({
    reason: z.string().optional(),
    timestamp: z.number()
})
export type Cancelled = z.infer<typeof cancelledSchema>

export const functionCallSchema = z.object({
    function_name: z.string(),
    result: z.string(),
    step_id: z.string()
})
export type FunctionCall = z.infer<typeof functionCallSchema>

export const naturalStopSchema = z.object({
    step_id: z.string(),
    timestamp: z.number()
})
export type NaturalStop = z.infer<typeof naturalStopSchema>

export const sendModelRequestSchema = z.object({
    user_message: z.string(),
    timezone: z.string(),
    ui_state: z.string().optional(),
    client_turn_id: z.string(),
    template_id: z.string().optional()
})
export type SendModelRequest = z.infer<typeof sendModelRequestSchema>

export const toolApprovalResponseSchema = z.object({
    step_id: z.string(),
    approved: z.boolean(),
    rejection_reason: z.string().optional(),
    timestamp: z.number()
})
export type ToolApprovalResponse = z.infer<typeof toolApprovalResponseSchema>

export const toolApprovalRequestSchema = z.object({
    step_id: z.string(),
    name: z.string(),
    arguments: z.string(),
    timestamp: z.number()
})
export type ToolApprovalRequest = z.infer<typeof toolApprovalRequestSchema>

export const textDeltaSchema = z.object({
    delta: z.string(),
    step_id: z.string(),
    timestamp: z.number()
})
export type TextDelta = z.infer<typeof textDeltaSchema>

export const toolCallGeneratingSchema = z.object({
    tool_name: z.string(),
    step_id: z.string(),
    timestamp: z.number()
})
export type ToolCallGenerating = z.infer<typeof toolCallGeneratingSchema>

export const toolCallSchema = z.object({
    summary: z.string(),
    step_id: z.string(),
    parameters: z.string(),
    integration: z.string(),
    timestamp: z.number()
})
export type ToolCall = z.infer<typeof toolCallSchema>

export const thinkingSchema = z.object({
    step_id: z.string(),
    timestamp: z.number()
})
export type Thinking = z.infer<typeof thinkingSchema>

export enum ToolCallExecutionStatus {
    COMPLETED = "completed",
    INCOMPLETE = "incomplete",
    FAILED = "failed",
    UNKNOWN = "unknown"
}

export const toolCallExecutionStatusSchema = z.enum(ToolCallExecutionStatus)

export const toolCallCompleteSchema = z.object({
    tool_name: z.string(),
    timestamp: z.number(),
    status: toolCallExecutionStatusSchema,
    step_id: z.string(),
    changed_items: z.array(changedItemSchema),
    integration: z.string(),
    url: z.string().optional(),
    result: z.string().optional(),
    errorContext: sharedErrorContextSchema.optional()
})
export type ToolCallComplete = z.infer<typeof toolCallCompleteSchema>

export const filterResultSchema = z.object({
    isRelevant: z.boolean(),
    reason: z.string(),
    confidence: z.number(),
    step_id: z.string(),
    timestamp: z.number()
})
export type FilterResult = z.infer<typeof filterResultSchema>

export enum SandboxStage {
    DOWNLOADING_SOURCE = "downloading_source",
    BOOTING = "booting",
    INSTALLING_DEPENDENCIES = "installing_dependencies",
    INSTALLING_CLI = "installing_cli",
    RUNNING = "running"
}

export const sandboxStageSchema = z.enum(SandboxStage)

export const SANDBOX_STAGE_LABELS: Record<SandboxStage, string> = {
    [SandboxStage.DOWNLOADING_SOURCE]: "Downloading source code",
    [SandboxStage.BOOTING]: "Booting sandbox",
    [SandboxStage.INSTALLING_DEPENDENCIES]: "Installing dependencies",
    [SandboxStage.INSTALLING_CLI]: "Installing CLI",
    [SandboxStage.RUNNING]: "Running agent"
}

export const userMessageSchema = z.object({
    message: z.string(),
    step_id: z.string(),
    client_turn_id: z.string(),
    timestamp: z.number()
})
export type UserMessage = z.infer<typeof userMessageSchema>

export const multipleChoiceOptionSchema = z.object({
    label: z.string(),
    value: z.string()
})

export const snippetVariantSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("button"),
        label: z.string(),
        url: z.string()
    }),
    z.object({
        type: z.literal("integration_prompt"),
        integration: z.string(),
        message: z.string(),
        stateToken: z.string().optional()
    }),
    z.object({
        type: z.literal("navigate"),
        path: z.string()
    }),
    z.object({
        type: z.literal("multiple_choice"),
        questionId: z.string(),
        question: z.string(),
        options: z.array(multipleChoiceOptionSchema),
        allowMultiple: z.boolean().optional()
    }),
    z.object({
        type: z.literal("image"),
        url: z.string()
    })
])
export type SnippetVariant = z.infer<typeof snippetVariantSchema>

export const chatSnippetSchema = z.intersection(
    z.object({
        id: z.string().optional(),
        step_id: z.string().optional(),
        selectedValue: z.string().optional()
    }),
    snippetVariantSchema
)
export type ChatSnippet = z.infer<typeof chatSnippetSchema>

export const modelEventSchema = z.discriminatedUnion("type", [
    toolApprovalResponseSchema.extend({
        type: z.literal("ToolApprovalResponse")
    }),
    toolApprovalRequestSchema.extend({
        type: z.literal("ToolApprovalRequest")
    }),
    toolCallGeneratingSchema.extend({
        type: z.literal("ToolCallGenerating")
    }),
    toolCallSchema.extend({
        type: z.literal("ToolCall")
    }),
    toolCallCompleteSchema.extend({
        type: z.literal("ToolCallComplete")
    }),
    textDeltaSchema.extend({
        type: z.literal("TextDelta")
    }),
    runErrorSchema.extend({
        type: z.literal("RunError")
    }),
    cancelledSchema.extend({
        type: z.literal("Cancelled")
    }),
    naturalStopSchema.extend({
        type: z.literal("NaturalStop")
    }),
    filterResultSchema.extend({
        type: z.literal("FilterResult")
    }),
    userMessageSchema.extend({
        type: z.literal("UserMessage")
    }),
    thinkingSchema.extend({
        type: z.literal("Thinking")
    }),
    z.object({
        type: z.literal("Snippet"),
        timestamp: z.number(),
        snippet: chatSnippetSchema
    })
])
export type ModelEvent = z.infer<typeof modelEventSchema>

export const modelRequestSchema = z.discriminatedUnion("type", [
    sendModelRequestSchema.extend({
        type: z.literal("SendModelRequest")
    }),
    toolApprovalResponseSchema.extend({
        type: z.literal("ToolApprovalResponse")
    })
])
export type ModelRequest = z.infer<typeof modelRequestSchema>
