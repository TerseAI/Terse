import type { AgentInputItem } from "@openai/agents-core"

import { BaseContextEvent } from "./BaseContextEvent"
import { appendContextEventToRunHistory } from "./contextEventSessions"

type FilterOutcomeContextEventPayload = {
    kind: "filter_outcome"
    isRelevant: boolean
    reason: string
    confidence: number
}

export type FilterOutcomeContextEventInput = {
    isRelevant: boolean
    reason: string
    confidence: number
}

export type ParsedFilterOutcomeContextEvent = {
    isRelevant: boolean
    reason: string
    confidence: number
}

function clampConfidence(value: number): number {
    return Math.max(0, Math.min(1, value))
}

class FilterOutcomeContextEvent extends BaseContextEvent<FilterOutcomeContextEventPayload, ParsedFilterOutcomeContextEvent> {
    constructor() {
        super("filter_outcome")
    }

    protected decodePayload(payload: unknown): ParsedFilterOutcomeContextEvent | null {
        const parsed = this.asRecord(payload)
        if (!parsed) return null

        if (this.getRequiredString(parsed, "kind") !== "filter_outcome") return null
        const isRelevant = this.getRequiredBoolean(parsed, "isRelevant")
        const reason = this.getRequiredString(parsed, "reason")
        const confidence = this.getRequiredFiniteNumber(parsed, "confidence")
        if (isRelevant === null || reason === null || confidence === null) return null

        return {
            isRelevant,
            reason,
            confidence: clampConfidence(confidence)
        }
    }
}

const filterOutcomeContextEvent = new FilterOutcomeContextEvent()

function buildPayload(input: FilterOutcomeContextEventInput): FilterOutcomeContextEventPayload {
    return {
        kind: "filter_outcome",
        isRelevant: input.isRelevant,
        reason: input.reason,
        confidence: clampConfidence(input.confidence)
    }
}

function buildText(input: FilterOutcomeContextEventInput): string {
    const relevance = input.isRelevant ? "relevant" : "not relevant"
    const confidence = clampConfidence(input.confidence).toFixed(2)
    return `Initial filter classified the event as ${relevance} (confidence ${confidence}). Reason: ${input.reason}`
}

export function buildFilterOutcomeContextEventItem(input: FilterOutcomeContextEventInput): AgentInputItem {
    return filterOutcomeContextEvent.createItem(buildPayload(input), buildText(input))
}

export function parseFilterOutcomeContextEventItem(item: unknown): ParsedFilterOutcomeContextEvent | null {
    return filterOutcomeContextEvent.parseItem(item)
}

export async function appendFilterOutcomeContextEvent(runId: string, input: FilterOutcomeContextEventInput): Promise<void> {
    await appendContextEventToRunHistory(runId, buildFilterOutcomeContextEventItem(input))
}
