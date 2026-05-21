import type { AgentInputItem } from "@openai/agents-core"
import { z } from "zod"

import { randomString } from "../../common/strings"

import { BaseSystemEvent } from "./BaseSystemEvent"
import { appendSystemEventToRunHistory } from "./systemEventSessions"

const processOutputSystemEventPayloadSchema = z.object({
    kind: z.literal("process_output"),
    id: z.string().trim().min(1).optional(),
    stream: z.enum(["stdout", "stderr"]),
    content: z.string(),
    label: z.string()
})

type ProcessOutputSystemEventPayload = z.infer<typeof processOutputSystemEventPayloadSchema>

export type ProcessOutputSystemEventInput = {
    id?: string
    stream: "stdout" | "stderr"
    content: string
    label: string
}

export type ParsedProcessOutputSystemEvent = ProcessOutputSystemEventInput

class ProcessOutputSystemEvent extends BaseSystemEvent<ProcessOutputSystemEventPayload, ParsedProcessOutputSystemEvent> {
    constructor() {
        super(processOutputSystemEventPayloadSchema)
    }

    protected decodePayload(payload: ProcessOutputSystemEventPayload): ParsedProcessOutputSystemEvent | null {
        return {
            id: payload.id,
            stream: payload.stream,
            content: payload.content,
            label: payload.label
        }
    }
}

const processOutputSystemEvent = new ProcessOutputSystemEvent()

export function buildProcessOutputSystemEventId(seed?: string): string {
    const normalizedSeed = seed?.trim()
    if (normalizedSeed) {
        return normalizedSeed.startsWith("msg_process_output-") ? normalizedSeed : `msg_process_output-${normalizedSeed}`
    }
    return `msg_process_output-${randomString(18)}`
}

function buildProcessOutputPayload(input: ProcessOutputSystemEventInput): ProcessOutputSystemEventPayload {
    return {
        kind: "process_output",
        id: buildProcessOutputSystemEventId(input.id),
        stream: input.stream,
        content: input.content,
        label: input.label
    }
}

function buildProcessOutputSystemEventItem(input: ProcessOutputSystemEventInput): AgentInputItem {
    return processOutputSystemEvent.createItem(buildProcessOutputPayload(input))
}

export function parseProcessOutputSystemEventItem(item: unknown): ParsedProcessOutputSystemEvent | null {
    return processOutputSystemEvent.parseItem(item)
}

export async function appendProcessOutputSystemEvent(runId: string, input: ProcessOutputSystemEventInput): Promise<void> {
    await appendSystemEventToRunHistory(runId, buildProcessOutputSystemEventItem(input))
}
