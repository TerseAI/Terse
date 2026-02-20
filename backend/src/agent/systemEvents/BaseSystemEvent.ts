import { system } from "@openai/agents"
import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

type SystemEventItemCandidate = {
    id?: unknown
    content?: unknown
    role?: unknown
}

export abstract class BaseSystemEvent<TPayload, TDecoded = TPayload> {
    private readonly payloadSchema: z.ZodType<TPayload>

    protected constructor(payloadSchema: z.ZodType<TPayload>) {
        this.payloadSchema = payloadSchema
    }

    createItem(payload: TPayload): AgentInputItem {
        const validatedPayload = this.payloadSchema.parse(payload)
        const eventId = this.extractEventId(validatedPayload)
        const item = system(JSON.stringify(validatedPayload), eventId ? { id: eventId } : undefined) as AgentInputItem

        // Mirror id at the top level for easier downstream dedup and matching.
        if (eventId && typeof item === "object" && item !== null) {
            ;(item as Record<string, unknown>).id = eventId
        }

        return item
    }

    parseItem(item: unknown): TDecoded | null {
        const parsedPayload = this.extractPayloadFromContent(item)
        if (parsedPayload === null) return null

        const result = this.payloadSchema.safeParse(parsedPayload)
        if (!result.success) return null

        return this.decodePayload(result.data)
    }

    protected abstract decodePayload(payload: TPayload): TDecoded | null

    private extractEventId(payload: TPayload): string | undefined {
        if (!payload || typeof payload !== "object") return undefined

        const maybeId = (payload as Record<string, unknown>).id
        if (typeof maybeId !== "string") return undefined

        const trimmed = maybeId.trim()
        return trimmed.length > 0 ? trimmed : undefined
    }

    private extractPayloadFromContent(item: unknown): unknown | null {
        const candidate = this.asRecord(item) as SystemEventItemCandidate | null
        if (!candidate) return null
        if (candidate.role !== "system") return null

        const content = this.extractContentText(candidate.content)
        if (!content) return null

        try {
            return JSON.parse(content)
        } catch {
            return null
        }
    }

    private asRecord(payload: unknown): Record<string, unknown> | null {
        if (!payload || typeof payload !== "object") return null
        return payload as Record<string, unknown>
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
}
