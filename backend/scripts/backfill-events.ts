/**
 * Unified backfill script that:
 *   Phase 1 — Migrates system events from run_history_chat_events → run_history_raw_events
 *   Phase 2 — Backfills event_key for all rows in run_history_raw_events and chat_raw_events
 *
 * Run this AFTER applying the add_event_key_columns migration and BEFORE applying
 * the unique_constraint_event_key migration.
 */
import type { AgentInputItem } from "@openai/agents-core"
import { Prisma, RunHistoryChatEventType } from "@prisma/client"
import "dotenv/config"

import { getEventKey } from "../src/agent/eventKey"
import { db } from "../src/prismaClient"
import { sanitizeAndCapModelItemId } from "../src/utility/strings"

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Phase 1 — Migrate system events from run_history_chat_events
// ---------------------------------------------------------------------------

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
    sequence_order: number
    created_at: Date
    raw_event_json?: unknown
}

/** Find the last assistant message id that looks like an OpenAI response id (resp_...) */
function findLastAssistantResponseId(rawEvents: { raw_event_json?: unknown; sequence_order: number }[]): string | null {
    const sorted = [...rawEvents].sort((a, b) => a.sequence_order - b.sequence_order)
    for (let i = sorted.length - 1; i >= 0; i--) {
        const item = asRecord(sorted[i].raw_event_json)
        if (!item) continue
        if (item.role !== "assistant") continue
        const id = typeof item.id === "string" ? item.id.trim() : ""
        if (id && id.startsWith("resp_")) return id
    }
    return null
}

function hasFilterOutcomeInRawEvents(eventKeys: Set<string>): boolean {
    return [...eventKeys].some(k => k.startsWith("id:filter_outcome-") || k.startsWith("id:msg_filter_outcome-"))
}

type SystemEventItem = {
    type: "message"
    role: "system"
    id: string
    content: string
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
          eventKey: string
          rawItem: SystemEventItem
      }

function clampConfidence(value: unknown): number {
    const numeric = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Math.max(0, Math.min(1, numeric))
}

function buildToolApprovalRequestId(stepId: string): string {
    const id = `msg_tool_approval_request-${stepId}`
    return id.length > 64 ? sanitizeAndCapModelItemId(id, `msg_tool_approval_request-${stepId.slice(0, 20)}`) : id
}

function buildToolApprovalResponseId(stepId: string): string {
    const id = `msg_tool_approval_response-${stepId}`
    return id.length > 64 ? sanitizeAndCapModelItemId(id, `msg_tool_approval_response-${stepId.slice(0, 20)}`) : id
}

function buildFilterOutcomeId(openAiResponseId: string): string {
    const trimmed = openAiResponseId.trim()
    if (!trimmed) throw new Error("buildFilterOutcomeId requires non-empty openAiResponseId")
    const id = `msg_filter_outcome-${trimmed}`
    return id.length > 64 ? sanitizeAndCapModelItemId(id, `msg_filter_outcome-${trimmed.slice(0, 20)}`) : id
}

function buildRunErrorId(chatEventId: string, runErrorId?: string): { id: string; runErrorId: string } {
    const trimmed = runErrorId?.trim()
    const resolvedRunErrorId = trimmed || `legacy-${chatEventId}`
    return {
        id: `msg_run_error-${resolvedRunErrorId}`,
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

function toSystemEvent(
    event: ChatEventRow,
    context: { existingRawEvents: ExistingRawRow[]; existingEventKeys: Set<string> }
): { eventKey: string; rawItem: SystemEventItem } | null {
    const payload = asRecord(event.event_json)
    if (!payload) return null

    if (event.event_type === RunHistoryChatEventType.FilterResult) {
        if (typeof payload.isRelevant !== "boolean" || typeof payload.reason !== "string") return null
        // Skip if we already have a filter_outcome in raw_events (avoids duplicate with wrong format)
        if (hasFilterOutcomeInRawEvents(context.existingEventKeys)) return null
        let openAiResponseId =
            typeof payload.openai_response_id === "string" ? payload.openai_response_id.trim() : ""
        if (!openAiResponseId && typeof payload.id === "string") {
            const id = payload.id.trim()
            if (id.startsWith("resp_")) openAiResponseId = id
        }
        if (!openAiResponseId) {
            openAiResponseId = findLastAssistantResponseId(context.existingRawEvents) ?? ""
        }
        if (!openAiResponseId) return null // Don't migrate without valid response id
        const id = buildFilterOutcomeId(openAiResponseId)
        return createSystemEventItem(
            {
                kind: "filter_outcome",
                openai_response_id: openAiResponseId,
                isRelevant: payload.isRelevant,
                reason: payload.reason,
                confidence: clampConfidence(payload.confidence)
            },
            id
        )
    }

    if (event.event_type === RunHistoryChatEventType.ToolApprovalRequest) {
        if (typeof payload.step_id !== "string" || typeof payload.name !== "string") return null
        const id = buildToolApprovalRequestId(payload.step_id)
        return createSystemEventItem(
            {
                kind: "tool_approval_request",
                step_id: payload.step_id,
                name: payload.name,
                arguments: typeof payload.arguments === "string" ? payload.arguments : JSON.stringify(payload.arguments ?? {})
            },
            id
        )
    }

    if (event.event_type === RunHistoryChatEventType.ToolApprovalResponse) {
        if (typeof payload.step_id !== "string" || typeof payload.approved !== "boolean") return null
        const id = buildToolApprovalResponseId(payload.step_id)
        return createSystemEventItem(
            {
                kind: "tool_approval_response",
                step_id: payload.step_id,
                approved: payload.approved
            },
            id
        )
    }

    if (event.event_type === RunHistoryChatEventType.RunError) {
        if (typeof payload.error !== "string") return null
        const existingRunErrorId = typeof payload.run_error_id === "string" ? payload.run_error_id : undefined
        const { id, runErrorId } = buildRunErrorId(event.id, existingRunErrorId)

        return createSystemEventItem(
            {
                kind: "run_error",
                run_error_id: runErrorId,
                error: payload.error,
                ...(typeof payload.code === "string" ? { code: payload.code } : {}),
                ...(typeof payload.hint === "string" ? { hint: payload.hint } : {})
            },
            id
        )
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

        if (left.kind === "existing" && right.kind === "existing") {
            return left.originalSequence - right.originalSequence
        }

        if (left.kind === "insert" && right.kind === "insert") {
            return left.insertOrder - right.insertOrder
        }

        return 0
    })
}

async function phase1MigrateSystemEvents(): Promise<void> {
    console.log("[backfill-events] Phase 1: Migrating system events from chat_events → raw_events")
    const prisma = db()

    // Diagnostic: list all run_ids that have rows with null event_key
    const runsWithNullEventKey = await prisma.$queryRaw<
        { run_history_record_id: string; null_count: bigint; row_ids: string[] }[]
    >`
        SELECT run_history_record_id,
               COUNT(*)::bigint AS null_count,
               ARRAY_AGG(id) AS row_ids
        FROM run_history_raw_events
        WHERE event_key IS NULL
        GROUP BY run_history_record_id
    `
    if (runsWithNullEventKey.length > 0) {
        console.warn("[backfill-events] Phase 1: Found run_history_raw_events rows with null event_key (will cause P2032):", {
            runCount: runsWithNullEventKey.length,
            runs: runsWithNullEventKey.map(r => ({
                runId: r.run_history_record_id,
                nullCount: Number(r.null_count),
                rowIds: r.row_ids
            }))
        })
    }

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
        try {
            const existingRawEvents: ExistingRawRow[] = await prisma.run_history_raw_events.findMany({
            where: { run_history_record_id: runId },
            orderBy: [{ sequence_order: "asc" }, { created_at: "asc" }, { id: "asc" }],
            select: {
                id: true,
                event_key: true,
                sequence_order: true,
                created_at: true,
                raw_event_json: true
            }
        })

        const existingEventKeys = new Set(existingRawEvents.map(event => event.event_key))
            const plannedInsertKeys = new Set<string>()
            const inserts: TimelineEntry[] = []
            const phase1Context = { existingRawEvents, existingEventKeys }

            for (let i = 0; i < runEvents.length; i++) {
                const event = runEvents[i]
                const systemEvent = toSystemEvent(event, phase1Context)
                if (!systemEvent) {
                    skipped += 1
                    continue
                }

                if (existingEventKeys.has(systemEvent.eventKey) || plannedInsertKeys.has(systemEvent.eventKey)) {
                    skippedExisting += 1
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
                    event_key: entry.eventKey,
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
        } catch (err) {
            console.error("[backfill-events] Phase 1: Failed for runId (likely null event_key in run_history_raw_events)", {
                runId,
                error: err instanceof Error ? err.message : String(err)
            })
            throw err
        }
    }

    console.log(
        `[backfill-events] Phase 1 complete: runs=${byRun.size} inserted=${inserted} sequenceUpdates=${sequenceUpdates} skipped=${skipped} skippedExisting=${skippedExisting}`
    )
}

// ---------------------------------------------------------------------------
// Phase 2 — Backfill event_key for all rows
// ---------------------------------------------------------------------------

type TableName = "run_history_raw_events" | "chat_raw_events"

type BackfillRow = {
    id: string
    event_key: string | null
    raw_event_json: unknown
    created_at: Date
    run_history_record_id?: string // Only for run_history_raw_events
}

const TABLES: TableName[] = ["run_history_raw_events", "chat_raw_events"]

function getSystemContentText(content: unknown): string {
    if (typeof content === "string") {
        return content
    }

    if (!Array.isArray(content)) {
        return ""
    }

    return content
        .map(part => {
            const parsed = asRecord(part)
            if (!parsed) return ""

            const text = parsed.text
            if (typeof text === "string") return text

            const inputText = parsed.input_text
            if (typeof inputText === "string") return inputText

            return ""
        })
        .filter(Boolean)
        .join("\n")
}

function normalizeSystemPayload(
    payload: Record<string, unknown>,
    rowId: string,
    resolvedFilterOutcomeResponseId?: string | null
): string | null {
    const kind = payload.kind
    if (typeof kind !== "string") return null

    if (kind === "tool_approval_request") {
        const stepId = payload.step_id
        if (typeof stepId !== "string" || !stepId.trim()) return null
        let id = `tool_approval_request-${stepId}`
        if (id.length > 64) id = sanitizeAndCapModelItemId(id, `tool_approval_request-${stepId.slice(0, 20)}`)
        payload.id = id
        return id
    }

    if (kind === "tool_approval_response") {
        const stepId = payload.step_id
        if (typeof stepId !== "string" || !stepId.trim()) return null
        let id = `tool_approval_response-${stepId}`
        if (id.length > 64) id = sanitizeAndCapModelItemId(id, `tool_approval_response-${stepId.slice(0, 20)}`)
        payload.id = id
        return id
    }

    if (kind === "filter_outcome") {
        let openAiResponseId = typeof payload.openai_response_id === "string" ? payload.openai_response_id.trim() : ""
        if (!openAiResponseId && resolvedFilterOutcomeResponseId) openAiResponseId = resolvedFilterOutcomeResponseId
        if (!openAiResponseId) return null // Don't use legacy format
        let id = `msg_filter_outcome-${openAiResponseId}`
        if (id.length > 64) id = sanitizeAndCapModelItemId(id, `msg_filter_outcome-${openAiResponseId.slice(0, 20)}`)
        payload.id = id
        payload.openai_response_id = openAiResponseId
        return id
    }

    if (kind === "run_error") {
        const existingRunErrorId = typeof payload.run_error_id === "string" ? payload.run_error_id.trim() : ""
        const runErrorId = existingRunErrorId || `legacy-${rowId}`
        payload.run_error_id = runErrorId
        let id = `run_error-${runErrorId}`
        if (id.length > 64) id = sanitizeAndCapModelItemId(id, `run_error-${runErrorId.slice(0, 20)}`)
        payload.id = id
        return id
    }

    const existingId = typeof payload.id === "string" ? payload.id.trim() : ""
    return existingId || null
}

function createUnixTimestampIdFromDate(createdAt: Date, sequence: number): string {
    const ms = createdAt.getTime()
    const seconds = Math.floor(ms / 1000)
    const micros = (ms % 1000) * 1000 + sequence
    return `msg_${seconds}.${String(micros).padStart(6, "0")}`
}

function hasCallId(item: Record<string, unknown>): boolean {
    return typeof item.callId === "string" && item.callId.trim().length > 0
}

async function backfillEventItemIds(
    item: AgentInputItem,
    row: BackfillRow,
    perTimestampSequence: Map<number, number>,
    fetchFilterOutcomeResponseId?: (runId: string) => Promise<string | null>
): Promise<{ normalizedItem: AgentInputItem; changed: boolean }> {
    const parsed = asRecord(item)
    if (!parsed) return { normalizedItem: item, changed: false }

    let changed = false
    const role = parsed.role

    if (role === "user") {
        const existingId = typeof parsed.id === "string" ? parsed.id.trim() : ""
        if (!existingId) {
            const ms = row.created_at.getTime()
            const seq = perTimestampSequence.get(ms) ?? 0
            perTimestampSequence.set(ms, seq + 1)

            parsed.id = createUnixTimestampIdFromDate(row.created_at, seq)
            changed = true
        }
    }

    if (role === "system") {
        const contentText = getSystemContentText(parsed.content)
        if (contentText) {
            try {
                const payload = JSON.parse(contentText)
                const payloadRecord = asRecord(payload)
                if (payloadRecord) {
                    let resolvedFilterOutcomeResponseId: string | null | undefined
                    if (
                        payloadRecord.kind === "filter_outcome" &&
                        !(typeof payloadRecord.openai_response_id === "string" && payloadRecord.openai_response_id.trim()) &&
                        row.run_history_record_id &&
                        fetchFilterOutcomeResponseId
                    ) {
                        resolvedFilterOutcomeResponseId = await fetchFilterOutcomeResponseId(row.run_history_record_id)
                    }
                    const systemEventId = normalizeSystemPayload(
                        payloadRecord,
                        row.id,
                        resolvedFilterOutcomeResponseId ?? undefined
                    )
                    if (systemEventId) {
                        if (parsed.id !== systemEventId) {
                            parsed.id = systemEventId
                            changed = true
                        }
                        const rewrittenContent = JSON.stringify(payloadRecord)
                        if (parsed.content !== rewrittenContent) {
                            parsed.content = rewrittenContent
                            changed = true
                        }
                    }
                }
            } catch {
                // Ignore non-JSON system content.
            }
        }
    }

    const hasId = typeof parsed.id === "string" && parsed.id.trim().length > 0
    if (!hasId && !hasCallId(parsed)) {
        // Ensure event_key is never "id:undefined" for legacy items with neither id nor callId.
        parsed.id = `legacy:${row.id}`
        changed = true
    }

    return { normalizedItem: parsed as AgentInputItem, changed }
}

async function backfillTable(table: TableName): Promise<void> {
    const prisma = db()
    const selectColumns =
        table === "run_history_raw_events"
            ? "id, event_key, raw_event_json, created_at, run_history_record_id"
            : "id, event_key, raw_event_json, created_at"
    const rows = await prisma.$queryRawUnsafe<BackfillRow[]>(
        `SELECT ${selectColumns}
         FROM "${table}"
         WHERE event_key IS NULL
            OR event_key = ''
            OR event_key = 'id:undefined'
            OR ((raw_event_json->>'role' = 'user' OR raw_event_json->>'role' = 'system') AND COALESCE(raw_event_json->>'id', '') = '')
         ORDER BY created_at ASC, id ASC`
    )

    const fetchFilterOutcomeResponseId =
        table === "run_history_raw_events"
            ? async (runId: string): Promise<string | null> => {
                  const rawEvents = await prisma.run_history_raw_events.findMany({
                      where: { run_history_record_id: runId },
                      orderBy: [{ sequence_order: "asc" }, { created_at: "asc" }],
                      select: { raw_event_json: true, sequence_order: true }
                  })
                  return findLastAssistantResponseId(rawEvents)
              }
            : undefined

    const perTimestampSequence = new Map<number, number>()
    let updated = 0

    for (const row of rows) {
        const { normalizedItem, changed } = await backfillEventItemIds(
            row.raw_event_json as AgentInputItem,
            row,
            perTimestampSequence,
            fetchFilterOutcomeResponseId
        )
        const nextEventKey = getEventKey(normalizedItem)

        const shouldWrite = changed || row.event_key !== nextEventKey
        if (!shouldWrite) {
            continue
        }

        await prisma.$executeRawUnsafe(
            `UPDATE "${table}"
             SET event_key = $1,
                 raw_event_json = $2::jsonb
             WHERE id = $3`,
            nextEventKey,
            JSON.stringify(normalizedItem),
            row.id
        )
        updated += 1
    }

    console.log(`[backfill-events] Phase 2 (${table}): scanned=${rows.length} updated=${updated}`)
}

async function phase2BackfillEventKeys(): Promise<void> {
    console.log("[backfill-events] Phase 2: Backfilling event_key for all tables")
    for (const table of TABLES) {
        await backfillTable(table)
    }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
    console.log("[backfill-events] Starting unified backfill")
    await phase1MigrateSystemEvents()
    await phase2BackfillEventKeys()
    console.log("[backfill-events] Done")
}

main()
    .catch(error => {
        console.error("[backfill-events] failed", error)
        process.exit(1)
    })
    .finally(async () => {
        await db().$disconnect()
    })
