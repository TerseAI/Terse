import type { AgentInputItem } from "@openai/agents-core"

import { BaseContextEvent } from "./BaseContextEvent"
import { appendContextEventToRunHistory } from "./contextEventSessions"

type ToolApprovalRequestContextEventPayload = {
    kind: "tool_approval_request"
    step_id: string
    name: string
    arguments: string
}

type ToolApprovalResponseContextEventPayload = {
    kind: "tool_approval_response"
    step_id: string
    approved: boolean
}

type ToolApprovalContextEventPayload = ToolApprovalRequestContextEventPayload | ToolApprovalResponseContextEventPayload

export type ToolApprovalRequestContextEventInput = {
    step_id: string
    name: string
    arguments: string
}

export type ToolApprovalResponseContextEventInput = {
    step_id: string
    approved: boolean
}

export type ParsedToolApprovalContextEvent =
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

class ToolApprovalContextEvent extends BaseContextEvent<ToolApprovalContextEventPayload, ParsedToolApprovalContextEvent> {
    constructor() {
        super("tool_approval")
    }

    protected decodePayload(payload: unknown): ParsedToolApprovalContextEvent | null {
        const parsed = this.asRecord(payload)
        if (!parsed) return null

        const stepId = this.getRequiredNonEmptyString(parsed, "step_id")
        if (!stepId) return null

        const kind = this.getRequiredString(parsed, "kind")
        if (kind === "tool_approval_request") {
            const name = this.getRequiredString(parsed, "name")
            const args = this.getRequiredString(parsed, "arguments")
            if (name === null || args === null) return null

            return {
                type: "ToolApprovalRequest",
                step_id: stepId,
                name,
                arguments: args
            }
        }

        if (kind === "tool_approval_response") {
            const approved = this.getRequiredBoolean(parsed, "approved")
            if (approved === null) return null

            return {
                type: "ToolApprovalResponse",
                step_id: stepId,
                approved
            }
        }

        return null
    }
}

const toolApprovalContextEvent = new ToolApprovalContextEvent()

function buildToolApprovalRequestPayload(input: ToolApprovalRequestContextEventInput): ToolApprovalRequestContextEventPayload {
    return {
        kind: "tool_approval_request",
        step_id: input.step_id,
        name: input.name,
        arguments: input.arguments
    }
}

function buildToolApprovalResponsePayload(input: ToolApprovalResponseContextEventInput): ToolApprovalResponseContextEventPayload {
    return {
        kind: "tool_approval_response",
        step_id: input.step_id,
        approved: input.approved
    }
}

function buildRequestText(input: ToolApprovalRequestContextEventInput): string {
    return `Approval requested for tool "${input.name}" on step ${input.step_id}.`
}

function buildResponseText(input: ToolApprovalResponseContextEventInput): string {
    return `Approval decision for step ${input.step_id}: ${input.approved ? "approved" : "rejected"}.`
}

export function buildToolApprovalRequestContextEventItem(input: ToolApprovalRequestContextEventInput): AgentInputItem {
    return toolApprovalContextEvent.createItem(buildToolApprovalRequestPayload(input), buildRequestText(input))
}

export function buildToolApprovalResponseContextEventItem(input: ToolApprovalResponseContextEventInput): AgentInputItem {
    return toolApprovalContextEvent.createItem(buildToolApprovalResponsePayload(input), buildResponseText(input))
}

export function parseToolApprovalContextEventItem(item: unknown): ParsedToolApprovalContextEvent | null {
    return toolApprovalContextEvent.parseItem(item)
}

export async function appendToolApprovalRequestContextEvent(runId: string, input: ToolApprovalRequestContextEventInput): Promise<void> {
    await appendContextEventToRunHistory(runId, buildToolApprovalRequestContextEventItem(input))
}

export async function appendToolApprovalResponseContextEvent(runId: string, input: ToolApprovalResponseContextEventInput): Promise<void> {
    await appendContextEventToRunHistory(runId, buildToolApprovalResponseContextEventItem(input))
}
