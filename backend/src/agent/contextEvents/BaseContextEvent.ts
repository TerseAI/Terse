import { system } from "@openai/agents"
import type { AgentInputItem } from "@openai/agents-core"

const CONTEXT_EVENT_SCHEMA = "terse.context_event.v1"
const CONTEXT_EVENT_BLOCK_LABEL = "terse-context-event"

type ContextEventEnvelope = {
    schema: string
    eventType: string
    payload: unknown
}

type ContextEventItemCandidate = {
    content?: unknown
    role?: unknown
}

export abstract class BaseContextEvent<TPayload, TDecoded = TPayload> {
    private readonly eventType: string

    protected constructor(eventType: string) {
        this.eventType = eventType
    }

    createItem(payload: TPayload, humanReadableText: string): AgentInputItem {
        const envelope: ContextEventEnvelope = {
            schema: CONTEXT_EVENT_SCHEMA,
            eventType: this.eventType,
            payload
        }

        return system(this.encodeContent(humanReadableText, envelope)) as AgentInputItem
    }

    parseItem(item: unknown): TDecoded | null {
        const envelope = this.extractEnvelopeFromContent(item)
        if (!envelope) return null
        if (envelope.schema !== CONTEXT_EVENT_SCHEMA) return null
        if (envelope.eventType !== this.eventType) return null
        return this.decodePayload(envelope.payload)
    }

    protected abstract decodePayload(payload: unknown): TDecoded | null

    protected asRecord(payload: unknown): Record<string, unknown> | null {
        if (!payload || typeof payload !== "object") return null
        return payload as Record<string, unknown>
    }

    protected getRequiredString(payload: Record<string, unknown>, key: string): string | null {
        const value = payload[key]
        return typeof value === "string" ? value : null
    }

    protected getRequiredNonEmptyString(payload: Record<string, unknown>, key: string): string | null {
        const value = this.getRequiredString(payload, key)
        if (!value || !value.trim()) return null
        return value
    }

    protected getOptionalString(payload: Record<string, unknown>, key: string): string | undefined {
        const value = payload[key]
        return typeof value === "string" && value ? value : undefined
    }

    protected getRequiredBoolean(payload: Record<string, unknown>, key: string): boolean | null {
        const value = payload[key]
        return typeof value === "boolean" ? value : null
    }

    protected getRequiredFiniteNumber(payload: Record<string, unknown>, key: string): number | null {
        const value = payload[key]
        if (typeof value !== "number" || Number.isNaN(value)) return null
        return value
    }

    private encodeContent(humanReadableText: string, envelope: ContextEventEnvelope): string {
        const renderedText = humanReadableText.trim()
        const serialized = JSON.stringify(envelope)
        return `${renderedText}\n\n\`\`\`${CONTEXT_EVENT_BLOCK_LABEL}\n${serialized}\n\`\`\``
    }

    private extractEnvelopeFromContent(item: unknown): ContextEventEnvelope | null {
        const candidate = this.asRecord(item) as ContextEventItemCandidate | null
        if (!candidate) return null
        if (candidate.role !== "system") return null

        const content = this.extractContentText(candidate.content)
        if (!content) return null

        const serialized = this.extractSerializedEnvelope(content)
        if (!serialized) return null

        try {
            const parsed = JSON.parse(serialized)
            const envelope = this.asRecord(parsed)
            if (!envelope) return null

            const schema = this.getRequiredString(envelope, "schema")
            const eventType = this.getRequiredString(envelope, "eventType")
            if (schema === null || eventType === null) return null

            return {
                schema,
                eventType,
                payload: envelope.payload
            }
        } catch {
            return null
        }
    }

    private extractContentText(content: unknown): string {
        if (typeof content === "string") {
            return content
        }

        if (!Array.isArray(content)) {
            return ""
        }

        return content
            .map(part => {
                const parsedPart = this.asRecord(part)
                if (!parsedPart) return ""

                const text = parsedPart.text
                if (typeof text === "string") return text

                const inputText = parsedPart.input_text
                if (typeof inputText === "string") return inputText

                return ""
            })
            .filter(Boolean)
            .join("\n")
    }

    private extractSerializedEnvelope(content: string): string | null {
        const startToken = `\`\`\`${CONTEXT_EVENT_BLOCK_LABEL}`
        const startIndex = content.lastIndexOf(startToken)
        if (startIndex === -1) return null

        const startAfterLabel = content.indexOf("\n", startIndex)
        if (startAfterLabel === -1) return null

        const endIndex = content.indexOf("\n```", startAfterLabel + 1)
        if (endIndex === -1) return null

        return content.slice(startAfterLabel + 1, endIndex).trim()
    }
}
