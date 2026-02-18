import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToRunHistory } from "./systemEventSessions"

const filterOutcomeSystemEventPayloadSchema = z.object({
    kind: z.literal("filter_outcome"),
    isRelevant: z.boolean(),
    reason: z.string(),
    confidence: z.number().finite()
})

type FilterOutcomeSystemEventPayload = z.infer<typeof filterOutcomeSystemEventPayloadSchema>

export type FilterOutcomeSystemEventInput = {
    isRelevant: boolean
    reason: string
    confidence: number
}

export type ParsedFilterOutcomeSystemEvent = {
    isRelevant: boolean
    reason: string
    confidence: number
}

function clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, value))
}

class FilterOutcomeSystemEvent extends BaseSystemEvent<FilterOutcomeSystemEventPayload, ParsedFilterOutcomeSystemEvent> {
    constructor() {
        super(filterOutcomeSystemEventPayloadSchema)
    }

    protected decodePayload(payload: FilterOutcomeSystemEventPayload): ParsedFilterOutcomeSystemEvent | null {
        return {
            isRelevant: payload.isRelevant,
            reason: payload.reason,
            confidence: clampConfidence(payload.confidence)
        }
    }
}

const filterOutcomeSystemEvent = new FilterOutcomeSystemEvent()

function buildPayload(input: FilterOutcomeSystemEventInput): FilterOutcomeSystemEventPayload {
    return {
        kind: "filter_outcome",
        isRelevant: input.isRelevant,
        reason: input.reason,
        confidence: clampConfidence(input.confidence)
    }
}

export function buildFilterOutcomeSystemEventItem(input: FilterOutcomeSystemEventInput): AgentInputItem {
    return filterOutcomeSystemEvent.createItem(buildPayload(input))
}

export function parseFilterOutcomeSystemEventItem(item: unknown): ParsedFilterOutcomeSystemEvent | null {
    return filterOutcomeSystemEvent.parseItem(item)
}

export async function appendFilterOutcomeSystemEvent(runId: string, input: FilterOutcomeSystemEventInput): Promise<void> {
    await appendSystemEventToRunHistory(runId, buildFilterOutcomeSystemEventItem(input))
}
