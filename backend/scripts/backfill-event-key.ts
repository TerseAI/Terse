import type { AgentInputItem } from "@openai/agents-core"
import "dotenv/config"

import { getEventKey } from "../src/agent/eventKey"
import { db } from "../src/prismaClient"
import { MODEL_ITEM_ID_MAX_LENGTH, MODEL_ITEM_ID_PATTERN, sanitizeAndCapIdentifier, sanitizeAndCapModelMessageId } from "../src/utility/strings"

type TableName = "run_history_raw_events" | "chat_raw_events"

type BackfillRow = {
    id: string
    event_key: string | null
    raw_event_json: unknown
    created_at: Date
}

const TABLES: TableName[] = ["run_history_raw_events", "chat_raw_events"]

function asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return value as Record<string, unknown>
}

function isValidModelItemId(value: unknown): value is string {
    return typeof value === "string" && value.length <= MODEL_ITEM_ID_MAX_LENGTH && MODEL_ITEM_ID_PATTERN.test(value)
}

function isMsgPrefixedModelItemId(value: unknown): value is string {
    return isValidModelItemId(value) && value.startsWith("msg_")
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

function normalizeSystemPayload(payload: Record<string, unknown>, rowId: string): string | null {
    const kind = payload.kind
    if (typeof kind !== "string") return null

    if (kind === "tool_approval_request") {
        const stepId = payload.step_id
        if (typeof stepId !== "string" || !stepId.trim()) return null
        const id = buildPrefixedId("tool_approval_request_", stepId, "step")
        payload.id = id
        return id
    }

    if (kind === "tool_approval_response") {
        const stepId = payload.step_id
        if (typeof stepId !== "string" || !stepId.trim()) return null
        const id = buildPrefixedId("tool_approval_response_", stepId, "step")
        payload.id = id
        return id
    }

    if (kind === "filter_outcome") {
        const openAiResponseId = typeof payload.openai_response_id === "string" ? payload.openai_response_id.trim() : ""
        if (openAiResponseId) {
            const id = buildPrefixedId("filter_outcome_", openAiResponseId, "response")
            payload.id = id
            return id
        }

        const existingId = typeof payload.id === "string" ? payload.id.trim() : ""
        if (existingId) {
            const sanitizedExistingId = sanitizeAndCapModelMessageId(existingId, "filter_outcome")
            payload.id = sanitizedExistingId
            return sanitizedExistingId
        }

        return null
    }

    if (kind === "run_error") {
        const existingRunErrorId = typeof payload.run_error_id === "string" ? payload.run_error_id.trim() : ""
        const runErrorId = buildCappedIdPart(existingRunErrorId || rowId, "run_error_", "run_error")
        payload.run_error_id = runErrorId
        const id = buildPrefixedId("run_error_", runErrorId, "run_error")
        payload.id = id
        return id
    }

    const existingId = typeof payload.id === "string" ? payload.id.trim() : ""
    if (!existingId) return null
    const sanitizedExistingId = sanitizeAndCapModelMessageId(existingId, "event")
    payload.id = sanitizedExistingId
    return sanitizedExistingId
}

function createUnixTimestampIdFromDate(createdAt: Date, sequence: number): string {
    const ms = createdAt.getTime()
    const seconds = Math.floor(ms / 1000)
    const micros = (ms % 1000) * 1000 + sequence
    return `msg_${seconds}_${String(micros).padStart(6, "0")}`
}

function hasCallId(item: Record<string, unknown>): boolean {
    return typeof item.callId === "string" && item.callId.trim().length > 0
}

function backfillEventItemIds(item: AgentInputItem, row: BackfillRow, perTimestampSequence: Map<number, number>): { normalizedItem: AgentInputItem; changed: boolean } {
    const parsed = asRecord(item)
    if (!parsed) return { normalizedItem: item, changed: false }

    let changed = false
    const role = parsed.role

    if (role === "user") {
        const existingId = typeof parsed.id === "string" ? parsed.id.trim() : ""
        if (!isMsgPrefixedModelItemId(existingId)) {
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
                    const systemEventId = normalizeSystemPayload(payloadRecord, row.id)
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

        const existingId = typeof parsed.id === "string" ? parsed.id.trim() : ""
        if (!isMsgPrefixedModelItemId(existingId) && !hasCallId(parsed)) {
            parsed.id = sanitizeAndCapModelMessageId(existingId || `event_${row.id}`, "event")
            changed = true
        }
    }

    const hasId = isValidModelItemId(parsed.id)
    if (!hasId && !hasCallId(parsed)) {
        // Ensure event_key is never "id:undefined" for items with neither id nor callId.
        parsed.id = buildPrefixedId("event_", row.id, "row")
        changed = true
    }

    return { normalizedItem: parsed as AgentInputItem, changed }
}

async function backfillTable(table: TableName): Promise<void> {
    const prisma = db()
    const rows = await prisma.$queryRawUnsafe<BackfillRow[]>(
        `SELECT id, event_key, raw_event_json, created_at
         FROM "${table}"
         WHERE event_key IS NULL
            OR event_key = ''
            OR event_key = 'id:undefined'
            OR (
                (raw_event_json->>'role' = 'user' OR raw_event_json->>'role' = 'system')
                AND (
                    COALESCE(raw_event_json->>'id', '') = ''
                    OR raw_event_json->>'id' ~ '[^A-Za-z0-9_-]'
                    OR char_length(raw_event_json->>'id') > 64
                    OR COALESCE(raw_event_json->>'id', '') !~ '^msg_'
                )
            )
         ORDER BY created_at ASC, id ASC`
    )

    const perTimestampSequence = new Map<number, number>()
    let updated = 0

    for (const row of rows) {
        const { normalizedItem, changed } = backfillEventItemIds(row.raw_event_json as AgentInputItem, row, perTimestampSequence)
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

    console.log(`[backfill-event-key] table=${table} scanned=${rows.length} updated=${updated}`)
}

async function main(): Promise<void> {
    for (const table of TABLES) {
        await backfillTable(table)
    }
}

main()
    .catch(error => {
        console.error("[backfill-event-key] failed", error)
        process.exit(1)
    })
    .finally(async () => {
        await db().$disconnect()
    })
