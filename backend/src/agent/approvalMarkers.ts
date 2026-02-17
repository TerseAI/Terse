import { system } from "@openai/agents"
import type { AgentInputItem } from "@openai/agents-core"

import { RunHistoryChatMemorySession } from "./CustomMemorySession"

const APPROVAL_MARKER_VERSION = "TERSE_TOOL_APPROVAL_MARKER_V1"
const MARKER_START = `<${APPROVAL_MARKER_VERSION}>`
const MARKER_END = `</${APPROVAL_MARKER_VERSION}>`

type ToolApprovalRequestMarkerPayload = {
    kind: "tool_approval_event"
    eventType: "ToolApprovalRequest"
    step_id: string
    name: string
    arguments: string
}

type ToolApprovalResponseMarkerPayload = {
    kind: "tool_approval_event"
    eventType: "ToolApprovalResponse"
    step_id: string
    approved: boolean
}

type ToolApprovalMarkerPayload = ToolApprovalRequestMarkerPayload | ToolApprovalResponseMarkerPayload

export type ToolApprovalRequestMarkerInput = {
    step_id: string
    name: string
    arguments: string
}

export type ToolApprovalResponseMarkerInput = {
    step_id: string
    approved: boolean
}

export type ParsedToolApprovalMarker =
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

function encodeMarker(payload: ToolApprovalMarkerPayload): string {
    return `${MARKER_START}\n${JSON.stringify(payload)}\n${MARKER_END}`
}

function decodeMarker(content: string): ToolApprovalMarkerPayload | null {
    const start = content.indexOf(MARKER_START)
    if (start === -1) return null

    const end = content.indexOf(MARKER_END, start + MARKER_START.length)
    if (end === -1) return null

    const serialized = content.slice(start + MARKER_START.length, end).trim()
    if (!serialized) return null

    try {
        const parsed = JSON.parse(serialized) as Partial<ToolApprovalMarkerPayload>
        if (parsed.kind !== "tool_approval_event") return null
        if (typeof parsed.step_id !== "string" || !parsed.step_id.trim()) return null

        if (parsed.eventType === "ToolApprovalRequest") {
            if (typeof parsed.name !== "string") return null
            if (typeof parsed.arguments !== "string") return null
            return {
                kind: "tool_approval_event",
                eventType: "ToolApprovalRequest",
                step_id: parsed.step_id,
                name: parsed.name,
                arguments: parsed.arguments
            }
        }

        if (parsed.eventType === "ToolApprovalResponse") {
            if (typeof parsed.approved !== "boolean") return null
            return {
                kind: "tool_approval_event",
                eventType: "ToolApprovalResponse",
                step_id: parsed.step_id,
                approved: parsed.approved
            }
        }

        return null
    } catch {
        return null
    }
}

function extractSystemMessageText(item: unknown): string | null {
    if (!item || typeof item !== "object") return null

    const maybeMessage = item as {
        role?: unknown
        content?: unknown
    }

    if (maybeMessage.role !== "system") return null
    if (typeof maybeMessage.content === "string") return maybeMessage.content

    if (Array.isArray(maybeMessage.content)) {
        const text = maybeMessage.content
            .map(part => {
                if (typeof part !== "object" || !part) return ""
                const p = part as { text?: unknown; input_text?: unknown }
                if (typeof p.text === "string") return p.text
                if (typeof p.input_text === "string") return p.input_text
                return ""
            })
            .join("\n")
            .trim()
        return text.length > 0 ? text : null
    }

    return null
}

function buildToolApprovalRequestPayload(input: ToolApprovalRequestMarkerInput): ToolApprovalRequestMarkerPayload {
    return {
        kind: "tool_approval_event",
        eventType: "ToolApprovalRequest",
        step_id: input.step_id,
        name: input.name,
        arguments: input.arguments
    }
}

function buildToolApprovalResponsePayload(input: ToolApprovalResponseMarkerInput): ToolApprovalResponseMarkerPayload {
    return {
        kind: "tool_approval_event",
        eventType: "ToolApprovalResponse",
        step_id: input.step_id,
        approved: input.approved
    }
}

export function buildToolApprovalRequestMarkerItem(input: ToolApprovalRequestMarkerInput): AgentInputItem {
    return system(encodeMarker(buildToolApprovalRequestPayload(input))) as AgentInputItem
}

export function buildToolApprovalResponseMarkerItem(input: ToolApprovalResponseMarkerInput): AgentInputItem {
    return system(encodeMarker(buildToolApprovalResponsePayload(input))) as AgentInputItem
}

export function parseToolApprovalMarkerItem(item: unknown): ParsedToolApprovalMarker | null {
    const content = extractSystemMessageText(item)
    if (!content) return null

    const marker = decodeMarker(content)
    if (!marker) return null

    if (marker.eventType === "ToolApprovalRequest") {
        return {
            type: "ToolApprovalRequest",
            step_id: marker.step_id,
            name: marker.name,
            arguments: marker.arguments
        }
    }

    return {
        type: "ToolApprovalResponse",
        step_id: marker.step_id,
        approved: marker.approved
    }
}

export async function appendToolApprovalRequestMarker(runId: string, input: ToolApprovalRequestMarkerInput): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runId })
    await session.addItems([buildToolApprovalRequestMarkerItem(input)])
}

export async function appendToolApprovalResponseMarker(runId: string, input: ToolApprovalResponseMarkerInput): Promise<void> {
    const session = new RunHistoryChatMemorySession({ sessionId: runId })
    await session.addItems([buildToolApprovalResponseMarkerItem(input)])
}
