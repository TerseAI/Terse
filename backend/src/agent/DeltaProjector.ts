import type { AgentInputItem, ResponseStreamEvent, RunStreamEvent } from "@openai/agents"
import { createHash, randomUUID } from "node:crypto"

type ModelStreamEvent = {
    type: string
    id?: unknown
    delta?: unknown
    toolName?: unknown
    providerMetadata?: unknown
    [key: string]: unknown
}

export type CanonicalModelEvent =
    | { type: "text-start"; id: string; responseId?: string }
    | { type: "text-delta"; id: string; delta: string; responseId: string }
    | { type: "text-end"; id: string; responseId: string }
    | { type: "reasoning-start"; id: string; responseId: string }
    | { type: "reasoning-delta"; id: string; delta: string; responseId: string }
    | { type: "reasoning-end"; id: string; responseId: string }
    | {
          type: "tool-input-start"
          id: string
          toolName: string
          responseId: string
      }
    | {
          type: "tool-input-delta"
          id: string
          delta: string
          responseId: string
      }
    | { type: "tool-input-end"; id: string; responseId: string }
    | {
          type: "tool-call"
          id: string
          toolName?: string
          input?: unknown
          responseId: string
      }
    | {
          type: "tool-result"
          id: string
          toolName?: string
          input?: unknown
          output?: unknown
          responseId: string
      }
    | {
          type: "tool-error"
          id: string
          toolName?: string
          input?: unknown
          error?: unknown
          responseId: string
      }
    | { type: "stream-start" }
    | { type: "response-metadata"; responseId: string }
    | { type: "finish" }
    | { type: "raw"; rawValue: unknown }

export function extractCompletedAssistantItems(event: RunStreamEvent): AgentInputItem[] {
    if (event.type === "raw_model_stream_event") {
        const data = getRawModelData(event)
        if (data?.type !== "response_done" || !Array.isArray(data.response?.output)) return []
        const responseId = normalizeResponseId(data.response.id)

        return data.response.output
            .filter(isAssistantMessageItem)
            .map((item: AgentInputItem) => {
                if (!responseId || getAssistantMessageId(item)) return item
                return {
                    ...(item as Record<string, any>),
                    providerData: {
                        ...(item as Record<string, any>).providerData,
                        responseId
                    }
                } as AgentInputItem
            })
            .map(normalizeItemForStorage)
    }

    if (event.type === "run_item_stream_event" && event.name === "message_output_created") {
        const rawItem = (event.item as any)?.rawItem
        if (!isAssistantMessageItem(rawItem)) return []
        return [normalizeItemForStorage(rawItem)]
    }

    return []
}

export class AssistantDeltaProjector {
    private currentResponseId: string | undefined
    private readonly completedResponseIds = new Set<string>()

    private stamp<T extends object>(event: T): T & { responseId?: string } {
        return this.currentResponseId ? { ...event, responseId: this.currentResponseId } : event
    }

    ingestModelEvent(event: RunStreamEvent): CanonicalModelEvent | undefined {
        const rawData = getRawModelData(event)
        if (rawData?.type === "response_done") {
            const responseId = normalizeResponseId(rawData.response?.id)
            if (responseId) this.completedResponseIds.add(responseId)
            this.currentResponseId = undefined
        }

        const modelEvent = extractModelEvent(event)
        if (!modelEvent) return undefined

        switch (modelEvent.type) {
            case "stream-start":
                return { type: "stream-start" }
            case "response-metadata": {
                const responseId = normalizeResponseId(modelEvent.id)
                if (responseId) this.currentResponseId = responseId
                return responseId ? { type: "response-metadata", responseId } : undefined
            }
            case "text-start": {
                const id = readNonEmptyString(modelEvent.id)
                return id ? this.stamp({ type: "text-start" as const, id }) : undefined
            }
            case "text-delta": {
                const id = readNonEmptyString(modelEvent.id)
                const delta = readNonEmptyText(modelEvent.delta)
                if (!id || !delta || !this.currentResponseId) return undefined
                return {
                    type: "text-delta",
                    id,
                    delta,
                    responseId: this.currentResponseId
                }
            }
            case "text-end": {
                const id = readNonEmptyString(modelEvent.id)
                if (!id || !this.currentResponseId) return undefined
                return id ? this.stamp({ type: "text-end" as const, id, responseId: this.currentResponseId }) : undefined
            }
            case "reasoning-start": {
                const id = readNonEmptyString(modelEvent.id)
                if (!id || !this.currentResponseId) return undefined
                return id ? this.stamp({ type: "reasoning-start" as const, id, responseId: this.currentResponseId }) : undefined
            }
            case "reasoning-delta": {
                const id = readNonEmptyString(modelEvent.id)
                const delta = readNonEmptyText(modelEvent.delta)
                if (!id || !delta || !this.currentResponseId) return undefined
                return {
                    type: "reasoning-delta",
                    id,
                    delta,
                    responseId: this.currentResponseId
                }
            }
            case "reasoning-end": {
                const id = readNonEmptyString(modelEvent.id)
                if (!id || !this.currentResponseId) return undefined
                return id ? this.stamp({ type: "reasoning-end" as const, id, responseId: this.currentResponseId }) : undefined
            }
            case "tool-input-start": {
                const id = readNonEmptyString(modelEvent.id)
                const toolName = readNonEmptyString(modelEvent.toolName)
                if (!id || !toolName || !this.currentResponseId) return undefined
                return {
                    type: "tool-input-start",
                    id,
                    toolName,
                    responseId: this.currentResponseId
                }
            }
            case "tool-input-delta": {
                const id = readNonEmptyString(modelEvent.id)
                const delta = readNonEmptyText(modelEvent.delta)
                if (!id || !delta || !this.currentResponseId) return undefined
                return {
                    type: "tool-input-delta",
                    id,
                    delta,
                    responseId: this.currentResponseId
                }
            }
            case "tool-input-end": {
                const id = readNonEmptyString(modelEvent.id)
                if (!id || !this.currentResponseId) return undefined
                return id ? this.stamp({ type: "tool-input-end" as const, id, responseId: this.currentResponseId }) : undefined
            }
            case "tool-call": {
                const id = readNonEmptyString(modelEvent.toolCallId) ?? readNonEmptyString(modelEvent.id)
                if (!id || !this.currentResponseId) return undefined
                const toolName = readNonEmptyString(modelEvent.toolName)
                const event: CanonicalModelEvent = {
                    type: "tool-call",
                    id,
                    responseId: this.currentResponseId
                }
                if (toolName) event.toolName = toolName
                if (modelEvent.input !== undefined) event.input = modelEvent.input
                return event
            }
            case "tool-result": {
                const id = readNonEmptyString(modelEvent.toolCallId) ?? readNonEmptyString(modelEvent.id)
                if (!id || !this.currentResponseId) return undefined
                const toolName = readNonEmptyString(modelEvent.toolName)
                const event: CanonicalModelEvent = {
                    type: "tool-result",
                    id,
                    responseId: this.currentResponseId
                }
                if (toolName) event.toolName = toolName
                if (modelEvent.input !== undefined) event.input = modelEvent.input
                if (modelEvent.output !== undefined) event.output = modelEvent.output
                return event
            }
            case "tool-error": {
                const id = readNonEmptyString(modelEvent.toolCallId) ?? readNonEmptyString(modelEvent.id)
                if (!id || !this.currentResponseId) return undefined
                const toolName = readNonEmptyString(modelEvent.toolName)
                const event: CanonicalModelEvent = {
                    type: "tool-error",
                    id,
                    responseId: this.currentResponseId
                }
                if (toolName) event.toolName = toolName
                if (modelEvent.input !== undefined) event.input = modelEvent.input
                if (modelEvent.error !== undefined) event.error = modelEvent.error
                return event
            }
            case "finish":
                return { type: "finish" }
            case "raw":
                return { type: "raw", rawValue: modelEvent.rawValue }
            default:
                return undefined
        }
    }

    getStreamedResponseIds(): string[] {
        return Array.from(this.completedResponseIds)
    }
}

export function buildAssistantSnapshot(itemId: string, text: string, status: "in_progress" | "completed"): AgentInputItem {
    return normalizeItemForStorage({
        type: "message",
        role: "assistant",
        id: itemId,
        status,
        content: [{ type: "output_text", text }],
        providerData: { responseId: itemId }
    } as AgentInputItem)
}

export function getAssistantText(item: AgentInputItem): string {
    return extractItemText(item)
}

function getRawModelData(event: RunStreamEvent): ResponseStreamEvent | undefined {
    return event.type === "raw_model_stream_event" ? (event.data as ResponseStreamEvent) : undefined
}

function extractModelEvent(event: RunStreamEvent): ModelStreamEvent | undefined {
    const data = getRawModelData(event)
    return data ? getModelStreamEvent(data) : undefined
}

function getModelStreamEvent(data: ResponseStreamEvent): ModelStreamEvent | undefined {
    if (data.type !== "model") return undefined
    if (!data.event || typeof data.event !== "object") return undefined
    return data.event as ModelStreamEvent
}

function normalizeResponseId(value: unknown): string | undefined {
    const responseId = readNonEmptyString(value)
    if (!responseId || responseId === "FAKE_ID") return undefined
    return responseId
}

type MutableRecord = Record<string, any>

const FAKE_RESPONSE_ID = "FAKE_ID"

export function cloneAgentItem<T extends AgentInputItem>(item: T): T {
    return structuredClone(item)
}

export function normalizeItemForStorage(item: AgentInputItem): AgentInputItem {
    const cloned = cloneAgentItem(item) as MutableRecord

    if (isMessageItem(cloned)) {
        cloned.type ??= "message"

        if (typeof cloned.id !== "string" || cloned.id.trim().length === 0) {
            if (cloned.role === "assistant") {
                const assistantId = getAssistantMessageId(cloned as AgentInputItem)
                if (!assistantId) {
                    throw new Error("Assistant message is missing a stable AI SDK id.")
                }
                cloned.id = assistantId
            } else if (cloned.role === "user") {
                cloned.id = `user_${randomUUID()}`
            }
        }
    }

    return cloned as AgentInputItem
}

export function buildAgentInputItemEventKey(item: AgentInputItem): string {
    const record = item as MutableRecord
    const itemType = getItemType(record)
    const itemId = readNonEmptyString(record.id)
    const callId = readNonEmptyString(record.callId) ?? readNonEmptyString(record.call_id)

    if (itemType === "message") {
        const messageId = getMessageStableId(item)
        if (!messageId) {
            throw new Error("Message item is missing a stable id; refusing hash-based deduplication.")
        }
        return `msg:${messageId}`
    }

    if (itemType === "function_call" && callId) return `fc:${callId}`
    if (itemType === "function_call_result" && callId) return `fcr:${callId}`
    if (itemType === "reasoning" && itemId) return `rs:${itemId}`
    if (callId && itemType) return `${itemType}:${callId}`

    return `hash:${hashItem(item)}`
}

export function getMessageStableId(item: AgentInputItem): string | undefined {
    const record = item as MutableRecord
    const itemId = readNonEmptyString(record.id)
    if (itemId) return itemId

    if (isMessageItem(record) && record.role === "assistant") {
        return getAssistantMessageId(record as AgentInputItem)
    }

    return undefined
}

export function getAssistantMessageId(item: AgentInputItem): string | undefined {
    const record = item as MutableRecord
    const responseId = readNonEmptyString(record.providerData?.responseId)
    if (responseId && responseId !== FAKE_RESPONSE_ID) return responseId
    return undefined
}

export function isAssistantMessageItem(item: unknown): item is AgentInputItem {
    return isMessageItem(item) && (item as MutableRecord).role === "assistant"
}

export function isUserMessageItem(item: unknown): item is AgentInputItem {
    return isMessageItem(item) && (item as MutableRecord).role === "user"
}

export function extractItemText(item: unknown): string {
    const content = (item as MutableRecord | null | undefined)?.content

    if (typeof content === "string") return content
    if (!Array.isArray(content)) return ""

    return content
        .map(part => {
            if (typeof part === "string") return part
            if (!part || typeof part !== "object") return ""
            if (typeof part.text === "string") return part.text
            if (typeof part.refusal === "string") return part.refusal
            if (typeof part.transcript === "string") return part.transcript
            return ""
        })
        .join("")
}

export function hashItem(item: unknown): string {
    return createHash("sha256")
        .update(JSON.stringify(normalizeForHash(item)))
        .digest("hex")
}

export function getItemType(item: MutableRecord): string {
    if (typeof item.type === "string") return item.type
    if (typeof item.role === "string") return "message"
    return ""
}

export function readNonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

export function readNonEmptyText(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined
}

function isMessageItem(item: unknown): item is MutableRecord {
    if (!item || typeof item !== "object") return false
    const record = item as MutableRecord
    return (record.type === "message" || record.type === undefined) && (record.role === "assistant" || record.role === "user" || record.role === "system")
}

function normalizeForHash(value: unknown): unknown {
    if (value === null || value === undefined) return value
    if (typeof value === "bigint") return value.toString()
    if (value instanceof Uint8Array) {
        return { __type: "Uint8Array", data: Buffer.from(value).toString("base64") }
    }
    if (Array.isArray(value)) return value.map(normalizeForHash)
    if (typeof value !== "object") return value

    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as object).sort()) {
        out[key] = normalizeForHash((value as MutableRecord)[key])
    }
    return out
}
