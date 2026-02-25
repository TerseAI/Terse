import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import type { ChatSnippetPayload } from "../../shared/ModelEvents"
import { randomString } from "../../utility/strings"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToRunHistory } from "./systemEventSessions"

const multipleChoiceOptionSchema = z.object({
    label: z.string(),
    value: z.string()
})

export const chatSnippetPayloadSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("button"),
        label: z.string(),
        url: z.string()
    }),
    z.object({
        type: z.literal("integration_prompt"),
        integration: z.string(),
        message: z.string(),
        stateToken: z.string().optional()
    }),
    z.object({
        type: z.literal("navigate"),
        path: z.string()
    }),
    z.object({
        type: z.literal("multiple_choice"),
        questionId: z.string(),
        question: z.string(),
        options: z.array(multipleChoiceOptionSchema),
        allowMultiple: z.boolean().optional()
    }),
    z.object({
        type: z.literal("image"),
        url: z.string()
    })
])

const snippetSystemEventPayloadSchema = z.object({
    kind: z.literal("snippet_view"),
    id: z.string().trim().min(1).optional(),
    snippet: chatSnippetPayloadSchema
})

type SnippetSystemEventPayload = z.infer<typeof snippetSystemEventPayloadSchema>

export type SnippetSystemEventInput = {
    id?: string
    snippet: ChatSnippetPayload
}

export type ParsedSnippetSystemEvent = {
    type: "Snippet"
    snippet: ChatSnippetPayload
}

class SnippetSystemEvent extends BaseSystemEvent<SnippetSystemEventPayload, ParsedSnippetSystemEvent> {
    constructor() {
        super(snippetSystemEventPayloadSchema)
    }

    protected decodePayload(payload: SnippetSystemEventPayload): ParsedSnippetSystemEvent | null {
        return {
            type: "Snippet",
            snippet: payload.snippet
        }
    }
}

const snippetSystemEvent = new SnippetSystemEvent()

export function buildSnippetSystemEventId(seed?: string): string {
    const normalizedSeed = seed?.trim()
    if (normalizedSeed) {
        return normalizedSeed.startsWith("msg_snippet_view-") ? normalizedSeed : `msg_snippet_view-${normalizedSeed}`
    }
    return `msg_snippet_view-${randomString(18)}`
}

function buildSnippetSystemEventPayload(input: SnippetSystemEventInput): SnippetSystemEventPayload {
    return {
        kind: "snippet_view",
        id: buildSnippetSystemEventId(input.id),
        snippet: input.snippet
    }
}

export function buildSnippetSystemEventItem(input: SnippetSystemEventInput): AgentInputItem {
    return snippetSystemEvent.createItem(buildSnippetSystemEventPayload(input))
}

export function parseSnippetSystemEventItem(item: unknown): ParsedSnippetSystemEvent | null {
    return snippetSystemEvent.parseItem(item)
}

export async function appendSnippetSystemEvent(runId: string, input: SnippetSystemEventInput): Promise<void> {
    await appendSystemEventToRunHistory(runId, buildSnippetSystemEventItem(input))
}
