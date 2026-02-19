import type { AgentInputItem } from "@openai/agents-core"
import { Prisma, RunHistoryChatEventType } from "@prisma/client"
import "dotenv/config"

import { getEventKey } from "../src/agent/eventKey"
import { db } from "../src/prismaClient"
import { MODEL_ITEM_ID_MAX_LENGTH, sanitizeAndCapIdentifier, sanitizeAndCapModelMessageId } from "../src/utility/strings"

const TARGET_EVENT_TYPES: RunHistoryChatEventType[] = [
    RunHistoryChatEventType.FilterResult,
    RunHistoryChatEventType.ToolApprovalRequest,
    RunHistoryChatEventType.ToolApprovalResponse,
    RunHistoryChatEventType.RunError
]

type ChatEventRow = {
    id: string
    run_history_record_id: string
    event_type: RunHistoryChatEventType
    event_json: Prisma.JsonValue
    timestamp: Date
}

type ExistingRawRow = {
    id: string
    event_key: string
    created_at: Date
}

type SystemEventItem = {
    type: "message"
    role: "system"
    id: string
    content: string
}

type SystemEventBuildResult = {
    eventKey: string
    rawItem: SystemEventItem
}

type TimelineEntry =
    | {
          kind: "existing"
          rawId: string
          createdAt: Date
      }
    | {
          kind: "insert"
          createdAt: Date
          insertOrder: number
          runId: string
          eventKey: string
          rawItem: SystemEventItem
      }

function asRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

function clampConfidence(value: unknown): number {
    const numeric = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Math.max(0, Math.min(1, numeric))
}

function buildCappedIdPart(value: string, prefix: string, fallback: string): string {
    const maxPartLength = Math.max(1, MODEL_ITEM_ID_MAX_LENGTH - prefix.length)
    return sanitizeAndCapIdentifier(value, {
        fallback,
        maxLength: maxPartLength
    })
}

function buildPrefixedId(prefix: string, value: string, fallback: string): string {
    return sanitizeAndCapModelMessageId(`${prefix}${buildCappedIdPart(value, prefix, fallback)}`, prefix.replace(/_+$/, ""))
}

function buildToolApprovalRequestId(stepId: string): string {
    return buildPrefixedId("tool_approval_request_", stepId, "step")
}

function buildToolApprovalResponseId(stepId: string): string {
    return buildPrefixedId("tool_approval_response_", stepId, "step")
}

function buildFilterOutcomeId(chatEventId: string, openAiResponseId?: string): string {
    const trimmed = openAiResponseId?.trim()
    if (!trimmed) {
        throw new Error(`Missing openai_response_id for filter outcome chat event: ${chatEventId}`)
    }
    return buildPrefixedId("filter_outcome_", trimmed, "response")
}

function buildRunErrorId(chatEventId: string, runErrorId?: string): { id: string; runErrorId: string } {
    const trimmed = runErrorId?.trim()
    const resolvedRunErrorId = buildCappedIdPart(trimmed || chatEventId, "run_error_", "run_error")
    return {
        id: buildPrefixedId("run_error_", resolvedRunErrorId, "run_error"),
        runErrorId: resolvedRunErrorId
    }
}

function createSystemEventItem(payload: Record<string, unknown>, id: string): { rawItem: SystemEventItem; eventKey: string } {
    const payloadWithId = { ...payload, id }
    const rawItem: SystemEventItem = {
        type: "message",
        role: "system",
        id,
        content: JSON.stringify(payloadWithId)
    }
    return {
        rawItem,
        eventKey: getEventKey(rawItem as AgentInputItem)
    }
}

function toSystemEvent(event: ChatEventRow): SystemEventBuildResult | null {
    const payload = asRecord(event.event_json)
    if (!payload) return null

    if (event.event_type === RunHistoryChatEventType.FilterResult) {
        if (typeof payload.isRelevant !== "boolean" || typeof payload.reason !== "string") return null
        const openAiResponseId = typeof payload.openai_response_id === "string" ? payload.openai_response_id : undefined
        if (!openAiResponseId?.trim()) return null
        const id = buildFilterOutcomeId(event.id, openAiResponseId)
        const built = createSystemEventItem(
            {
                kind: "filter_outcome",
                ...(openAiResponseId ? { openai_response_id: openAiResponseId } : {}),
                isRelevant: payload.isRelevant,
                reason: payload.reason,
                confidence: clampConfidence(payload.confidence)
            },
            id
        )
        return built
    }

    if (event.event_type === RunHistoryChatEventType.ToolApprovalRequest) {
        if (typeof payload.step_id !== "string" || typeof payload.name !== "string") return null
        const id = buildToolApprovalRequestId(payload.step_id)
        const built = createSystemEventItem(
            {
                kind: "tool_approval_request",
                step_id: payload.step_id,
                name: payload.name,
                arguments: typeof payload.arguments === "string" ? payload.arguments : JSON.stringify(payload.arguments ?? {})
            },
            id
        )
        return built
    }

    if (event.event_type === RunHistoryChatEventType.ToolApprovalResponse) {
        if (typeof payload.step_id !== "string" || typeof payload.approved !== "boolean") return null
        const id = buildToolApprovalResponseId(payload.step_id)
        const built = createSystemEventItem(
            {
                kind: "tool_approval_response",
                step_id: payload.step_id,
                approved: payload.approved
            },
            id
        )
        return built
    }

    if (event.event_type === RunHistoryChatEventType.RunError) {
        if (typeof payload.error !== "string") return null
        const existingRunErrorId = typeof payload.run_error_id === "string" ? payload.run_error_id : undefined
        const { id, runErrorId } = buildRunErrorId(event.id, existingRunErrorId)

        const built = createSystemEventItem(
            {
                kind: "run_error",
                run_error_id: runErrorId,
                error: payload.error,
                ...(typeof payload.code === "string" ? { code: payload.code } : {}),
                ...(typeof payload.hint === "string" ? { hint: payload.hint } : {})
            },
            id
        )
        return built
    }

    return null
}

function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
    return entries.sort((left, right) => {
        const tsDelta = left.createdAt.getTime() - right.createdAt.getTime()
        if (tsDelta !== 0) return tsDelta

        if (left.kind !== right.kind) {
            return left.kind === "existing" ? -1 : 1
        }

        if (left.kind === "insert" && right.kind === "insert") {
            return left.insertOrder - right.insertOrder
        }

        return 0
    })
}

async function main(): Promise<void> {
    const prisma = db()

    const chatEvents = await prisma.run_history_chat_events.findMany({
        where: {
            event_type: {
                in: TARGET_EVENT_TYPES
            }
        },
        orderBy: [{ run_history_record_id: "asc" }, { timestamp: "asc" }, { id: "asc" }],
        select: {
            id: true,
            run_history_record_id: true,
            event_type: true,
            event_json: true,
            timestamp: true
        }
    })

    const byRun = new Map<string, ChatEventRow[]>()
    for (const event of chatEvents) {
        const existing = byRun.get(event.run_history_record_id)
        if (existing) {
            existing.push(event)
        } else {
            byRun.set(event.run_history_record_id, [event])
        }
    }

    let inserted = 0
    let skipped = 0
    let skippedExisting = 0
    let sequenceUpdates = 0

    for (const [runId, runEvents] of byRun) {
        const plannedInsertKeys = new Set<string>()
        const inserts: TimelineEntry[] = []

        for (let i = 0; i < runEvents.length; i++) {
            const event = runEvents[i]
            const systemEvent = toSystemEvent(event)
            if (!systemEvent) {
                skipped += 1
                continue
            }
            plannedInsertKeys.add(systemEvent.eventKey)

            inserts.push({
                kind: "insert",
                createdAt: event.timestamp,
                insertOrder: i,
                runId,
                eventKey: systemEvent.eventKey,
                rawItem: systemEvent.rawItem
            })
        }

        if (inserts.length === 0) continue

        const merged = sortTimeline([...inserts])
        const rowsToInsert: Prisma.run_history_raw_eventsCreateManyInput[] = []

        for (let sequence = 0; sequence < merged.length; sequence++) {
            const entry = merged[sequence]
            if (entry.kind === "existing") {
                continue
            }

            rowsToInsert.push({
                run_history_record_id: entry.runId,
                event_key: entry.eventKey,
                raw_event_json: entry.rawItem as unknown as Prisma.InputJsonValue,
                created_at: entry.createdAt
            })
        }

        await prisma.$transaction(async tx => {
            await tx.run_history_raw_events.createMany({
                data: rowsToInsert
            })
        })

        inserted += rowsToInsert.length
    }

    console.log(`[backfill-run-history-system-events] runs=${byRun.size} inserted=${inserted} sequenceUpdates=${sequenceUpdates} skipped=${skipped} skippedExisting=${skippedExisting}`)
}

main()
    .catch(error => {
        console.error("[backfill-run-history-system-events] failed", error)
        process.exit(1)
    })
    .finally(async () => {
        await db().$disconnect()
    })
