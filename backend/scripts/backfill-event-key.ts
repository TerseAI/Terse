import type { AgentInputItem } from "@openai/agents-core"
import "dotenv/config"

import { getEventKey } from "../src/agent/eventKey"
import { db } from "../src/prismaClient"

type TableName = "run_history_raw_events" | "chat_raw_events"

type MissingEventKeyRow = {
    id: string
    raw_event_json: unknown
}

const TABLES: TableName[] = ["run_history_raw_events", "chat_raw_events"]

async function backfillTable(table: TableName): Promise<void> {
    const prisma = db()
    const rows = await prisma.$queryRawUnsafe<MissingEventKeyRow[]>(
        `SELECT id, raw_event_json
         FROM "${table}"
         WHERE event_key IS NULL OR event_key = ''`
    )

    let updated = 0
    for (const row of rows) {
        const eventKey = getEventKey(row.raw_event_json as AgentInputItem) ?? `fallback:${table}:${row.id}`
        await prisma.$executeRawUnsafe(
            `UPDATE "${table}"
             SET event_key = $1
             WHERE id = $2`,
            eventKey,
            row.id
        )
        updated += 1
    }

    console.log(`[backfill-event-key] table=${table} updated=${updated}`)
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
