import type { ResponseStreamEvent, RunStreamEvent } from "@openai/agents"
import { Decision } from "terse-types"

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
    | { type: "finish"; responseId?: string }
    | { type: "raw"; rawValue: unknown }

export class AssistantDeltaProjector {
    private currentResponseId: string | undefined
    private readonly completedResponseIds = new Set<string>()

    constructor(options?: { initialResponseId?: string; decision?: Decision }) {
        this.currentResponseId = options?.initialResponseId
    }

    private stamp<T extends object>(event: T): T & { responseId?: string } {
        return this.currentResponseId ? { ...event, responseId: this.currentResponseId } : event
    }

    ingestModelEvent(event: RunStreamEvent): CanonicalModelEvent | undefined {
        if (event.type === "run_item_stream_event" && event.name === "tool_output") {
            return this.projectToolOutputItem(event.item)
        }

        const rawData = getRawModelData(event)
        if (rawData?.type === "response_done") {
            const responseId = normalizeResponseId(rawData.response?.id)
            if (responseId) this.completedResponseIds.add(responseId)
            // Keep currentResponseId so trailing tool_output events stamp with the call's responseId; the next response-metadata will overwrite it.
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
                return this.currentResponseId ? { type: "finish", responseId: this.currentResponseId } : { type: "finish" }
            case "raw":
                return { type: "raw", rawValue: modelEvent.rawValue }
        }
    }

    private projectToolOutputItem(item: unknown): CanonicalModelEvent | undefined {
        if (!this.currentResponseId) return undefined
        const record = item as MutableRecord
        const rawItem = record?.rawItem as MutableRecord | undefined
        if (!rawItem) return undefined

        const id = readNonEmptyString(rawItem.callId)
        if (!id) return undefined
        const toolName = readNonEmptyString(rawItem.name)
        const event: CanonicalModelEvent = {
            type: "tool-result",
            id,
            responseId: this.currentResponseId
        }
        if (toolName) event.toolName = toolName
        // Forward the structured {type,text} so extractToolExecutionErrorContext can detect the SDK's "Error:" shape.
        if (rawItem.output !== undefined) event.output = rawItem.output
        return event
    }
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

export function readNonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined
}

export function readNonEmptyText(value: unknown): string | undefined {
    return typeof value === "string" && value.length > 0 ? value : undefined
}
