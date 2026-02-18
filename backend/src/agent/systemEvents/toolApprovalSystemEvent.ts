import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToRunHistory } from "./systemEventSessions"

const toolApprovalRequestSystemEventPayloadSchema = z.object({
    kind: z.literal("tool_approval_request"),
    step_id: z.string().trim().min(1),
    name: z.string(),
    arguments: z.string()
})

const toolApprovalResponseSystemEventPayloadSchema = z.object({
    kind: z.literal("tool_approval_response"),
    step_id: z.string().trim().min(1),
    approved: z.boolean()
})

const toolApprovalSystemEventPayloadSchema = z.discriminatedUnion("kind", [toolApprovalRequestSystemEventPayloadSchema, toolApprovalResponseSystemEventPayloadSchema])

type ToolApprovalRequestSystemEventPayload = z.infer<typeof toolApprovalRequestSystemEventPayloadSchema>
type ToolApprovalResponseSystemEventPayload = z.infer<typeof toolApprovalResponseSystemEventPayloadSchema>
type ToolApprovalSystemEventPayload = z.infer<typeof toolApprovalSystemEventPayloadSchema>

export type ToolApprovalRequestSystemEventInput = {
    step_id: string
    name: string
    arguments: string
}

export type ToolApprovalResponseSystemEventInput = {
    step_id: string
    approved: boolean
}

export type ParsedToolApprovalSystemEvent =
    | {
          type: "ToolApprovalRequest"
          step_id: string
          name: string
          arguments: string
      }
    | {
          type: "ToolApprovalResponse"
          step_id: string
          approved: boolean
      }

class ToolApprovalSystemEvent extends BaseSystemEvent<ToolApprovalSystemEventPayload, ParsedToolApprovalSystemEvent> {
    constructor() {
        super(toolApprovalSystemEventPayloadSchema)
    }

    protected decodePayload(payload: ToolApprovalSystemEventPayload): ParsedToolApprovalSystemEvent | null {
        if (payload.kind === "tool_approval_request") {
            return {
                type: "ToolApprovalRequest",
                step_id: payload.step_id,
                name: payload.name,
                arguments: payload.arguments
            }
        }

        return {
            type: "ToolApprovalResponse",
            step_id: payload.step_id,
            approved: payload.approved
        }
    }
}

const toolApprovalSystemEvent = new ToolApprovalSystemEvent()

function buildToolApprovalRequestPayload(input: ToolApprovalRequestSystemEventInput): ToolApprovalRequestSystemEventPayload {
    return {
        kind: "tool_approval_request",
        step_id: input.step_id,
        name: input.name,
        arguments: input.arguments
    }
}

function buildToolApprovalResponsePayload(input: ToolApprovalResponseSystemEventInput): ToolApprovalResponseSystemEventPayload {
    return {
        kind: "tool_approval_response",
        step_id: input.step_id,
        approved: input.approved
    }
}

export function buildToolApprovalRequestSystemEventItem(input: ToolApprovalRequestSystemEventInput): AgentInputItem {
    return toolApprovalSystemEvent.createItem(buildToolApprovalRequestPayload(input))
}

export function buildToolApprovalResponseSystemEventItem(input: ToolApprovalResponseSystemEventInput): AgentInputItem {
    return toolApprovalSystemEvent.createItem(buildToolApprovalResponsePayload(input))
}

export function parseToolApprovalSystemEventItem(item: unknown): ParsedToolApprovalSystemEvent | null {
    return toolApprovalSystemEvent.parseItem(item)
}

export async function appendToolApprovalRequestSystemEvent(runId: string, input: ToolApprovalRequestSystemEventInput): Promise<void> {
    await appendSystemEventToRunHistory(runId, buildToolApprovalRequestSystemEventItem(input))
}

export async function appendToolApprovalResponseSystemEvent(runId: string, input: ToolApprovalResponseSystemEventInput): Promise<void> {
    await appendSystemEventToRunHistory(runId, buildToolApprovalResponseSystemEventItem(input))
}
