import { Prisma, RunHistoryChatEventType } from "@prisma/client"
import "dotenv/config"

import { db } from "../src/prismaClient"

const TARGET_EVENT_TYPES: RunHistoryChatEventType[] = [RunHistoryChatEventType.FilterResult, RunHistoryChatEventType.ToolApprovalRequest, RunHistoryChatEventType.ToolApprovalResponse, RunHistoryChatEventType.RunError]

type ChatEventRow = {
    id: string
    run_history_record_id: string
    event_type: RunHistoryChatEventType
    event_json: Prisma.JsonValue
    timestamp: Date
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

type SystemEventItem = {
    role: "system"
    content: string
}

function clampConfidence(value: unknown): number {
    const numeric = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Math.max(0, Math.min(1, numeric))
}

function createSystemEventItem(payload: Record<string, unknown>): SystemEventItem {
    return {
        role: "system",
        content: JSON.stringify(payload)
    }
}

function toSystemEventItem(event: ChatEventRow): SystemEventItem | null {
    const payload = asRecord(event.event_json)
    if (!payload) return null

    if (event.event_type === RunHistoryChatEventType.FilterResult) {
        if (typeof payload.isRelevant !== "boolean" || typeof payload.reason !== "string") return null
        return createSystemEventItem({
            kind: "filter_outcome",
            isRelevant: payload.isRelevant,
            reason: payload.reason,
            confidence: clampConfidence(payload.confidence)
        })
    }

    if (event.event_type === RunHistoryChatEventType.ToolApprovalRequest) {
        if (typeof payload.step_id !== "string" || typeof payload.name !== "string") return null
        return createSystemEventItem({
            kind: "tool_approval_request",
            step_id: payload.step_id,
            name: payload.name,
            arguments: typeof payload.arguments === "string" ? payload.arguments : JSON.stringify(payload.arguments ?? {})
        })
    }

    if (event.event_type === RunHistoryChatEventType.ToolApprovalResponse) {
        if (typeof payload.step_id !== "string" || typeof payload.approved !== "boolean") return null
        return createSystemEventItem({
            kind: "tool_approval_response",
            step_id: payload.step_id,
            approved: payload.approved
        })
    }

    if (event.event_type === RunHistoryChatEventType.RunError) {
        if (typeof payload.error !== "string") return null
        return createSystemEventItem({
            kind: "run_error",
            error: payload.error,
            ...(typeof payload.code === "string" ? { code: payload.code } : {})
        })
    }

    return null
}

type ExistingRawRow = {
    id: string
    sequence_order: number
    created_at: Date
}

type TimelineEntry =
    | {
          kind: "existing"
          rawId: string
          createdAt: Date
          originalSequence: number
      }
    | {
          kind: "insert"
          createdAt: Date
          insertOrder: number
          runId: string
          rawItem: SystemEventItem
      }

function sortTimeline(entries: TimelineEntry[]): TimelineEntry[] {
    return entries.sort((left, right) => {
        const tsDelta = left.createdAt.getTime() - right.createdAt.getTime()
        if (tsDelta !== 0) return tsDelta

        if (left.kind !== right.kind) {
            return left.kind === "existing" ? -1 : 1
        }

        if (left.kind === "existing" && right.kind === "existing") {
            return left.originalSequence - right.originalSequence
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
    let sequenceUpdates = 0

    for (const [runId, runEvents] of byRun) {
        const existingRawEvents: ExistingRawRow[] = await prisma.run_history_raw_events.findMany({
            where: { run_history_record_id: runId },
            orderBy: [{ sequence_order: "asc" }, { created_at: "asc" }, { id: "asc" }],
            select: {
                id: true,
                sequence_order: true,
                created_at: true
            }
        })

        const inserts: TimelineEntry[] = []
        for (let i = 0; i < runEvents.length; i++) {
            const event = runEvents[i]
            const rawItem = toSystemEventItem(event)
            if (!rawItem) {
                skipped += 1
                continue
            }

            inserts.push({
                kind: "insert",
                createdAt: event.timestamp,
                insertOrder: i,
                runId,
                rawItem
            })
        }

        if (inserts.length === 0) continue

        const existingEntries: TimelineEntry[] = existingRawEvents.map(raw => ({
            kind: "existing",
            rawId: raw.id,
            createdAt: raw.created_at,
            originalSequence: raw.sequence_order
        }))

        const merged = sortTimeline([...existingEntries, ...inserts])
        const updates: { id: string; sequence: number }[] = []
        const rowsToInsert: Prisma.run_history_raw_eventsCreateManyInput[] = []

        for (let sequence = 0; sequence < merged.length; sequence++) {
            const entry = merged[sequence]
            if (entry.kind === "existing") {
                if (entry.originalSequence !== sequence) {
                    updates.push({ id: entry.rawId, sequence })
                }
                continue
            }

            rowsToInsert.push({
                run_history_record_id: entry.runId,
                raw_event_json: entry.rawItem as unknown as Prisma.InputJsonValue,
                sequence_order: sequence,
                created_at: entry.createdAt
            })
        }

        await prisma.$transaction(async tx => {
            for (const update of updates) {
                await tx.run_history_raw_events.update({
                    where: { id: update.id },
                    data: { sequence_order: update.sequence }
                })
            }

            await tx.run_history_raw_events.createMany({
                data: rowsToInsert
            })
        })

        inserted += rowsToInsert.length
        sequenceUpdates += updates.length
    }

    console.log(`[backfill-run-history-system-events] runs=${byRun.size} inserted=${inserted} sequenceUpdates=${sequenceUpdates} skipped=${skipped}`)
}

main()
    .catch(error => {
        console.error("[backfill-run-history-system-events] failed", error)
        process.exit(1)
    })
    .finally(async () => {
        await db().$disconnect()
    })
