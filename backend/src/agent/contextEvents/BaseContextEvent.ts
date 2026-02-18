import { system } from "@openai/agents"
import type { AgentInputItem } from "@openai/agents-core"

const CONTEXT_EVENT_PROVIDER_KEY = "terse_context_event"
const CONTEXT_EVENT_SCHEMA = "terse.context_event.v1"

type ContextEventEnvelope = {
    schema: string
    eventType: string
    payload: unknown
}

type ContextEventItemCandidate = {
    role?: unknown
    providerData?: unknown
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

        return system(humanReadableText, {
            [CONTEXT_EVENT_PROVIDER_KEY]: envelope
        }) as AgentInputItem
    }

    parseItem(item: unknown): TDecoded | null {
        const envelope = this.extractEnvelope(item)
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

    private extractEnvelope(item: unknown): ContextEventEnvelope | null {
        const candidate = this.asRecord(item) as ContextEventItemCandidate | null
        if (!candidate) return null
        if (candidate.role !== "system") return null

        const providerData = this.asRecord(candidate.providerData)
        if (!providerData) return null

        const envelope = this.asRecord(providerData[CONTEXT_EVENT_PROVIDER_KEY])
        if (!envelope) return null

        const schema = this.getRequiredString(envelope, "schema")
        const eventType = this.getRequiredString(envelope, "eventType")
        if (schema === null || eventType === null) return null

        return {
            schema,
            eventType,
            payload: envelope.payload
        }
    }
}
