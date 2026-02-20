import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import { randomString, sanitizeAndCapModelMessageId } from "../../utility/strings"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToRunHistory } from "./systemEventSessions"

const filterOutcomeSystemEventPayloadSchema = z.object({
    kind: z.literal("filter_outcome"),
    id: z.string().trim().min(1).optional(),
    openai_response_id: z.string().trim().min(1).optional(),
    isRelevant: z.boolean(),
    reason: z.string(),
    confidence: z.number().finite()
})

type FilterOutcomeSystemEventPayload = z.infer<typeof filterOutcomeSystemEventPayloadSchema>

export type FilterOutcomeSystemEventInput = {
    isRelevant: boolean
    reason: string
    confidence: number
    openai_response_id?: string
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

function buildFilterOutcomeSystemEventId(input: FilterOutcomeSystemEventInput): string {
    const responseId = input.openai_response_id?.trim()
    if (responseId) {
        return `filter_outcome:${responseId}`
    }

    return `filter_outcome:${randomString(18)}`
}

function buildPayload(input: FilterOutcomeSystemEventInput): FilterOutcomeSystemEventPayload {
    return {
        kind: "filter_outcome",
        id: buildFilterOutcomeSystemEventId(input),
        ...(input.openai_response_id ? { openai_response_id: input.openai_response_id } : {}),
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
