import "dotenv/config"

import { db } from "../src/prismaClient"
import { GSM_SENTINEL, isGsmAvailable, storeSecret } from "../src/services/SecretService"

type SecretTableConfig = {
    table: string
    fields: string[]
}

type MigrationStats = {
    table: string
    rowsScanned: number
    columnsChecked: number
    eligibleColumns: number
    migratedColumns: number
    wouldMigrateColumns: number
    alreadyGsmColumns: number
    nullColumns: number
    nonStringColumns: number
    fallbackColumns: number
    errors: number
}

const SECRET_TABLES: SecretTableConfig[] = [
    { table: "github_app_tokens", fields: ["access_token", "refresh_token"] },
    { table: "linear_integrations", fields: ["access_token", "refresh_token"] },
    { table: "user_slack_integrations", fields: ["authed_user_access_token"] },
    { table: "slack_integrations", fields: ["access_token"] },
    { table: "atlassian_integrations", fields: ["access_token", "refresh_token", "webhook_secret"] },
    { table: "gmail_integrations", fields: ["access_token", "refresh_token"] },
    { table: "notion_integrations", fields: ["integration_token"] },
    { table: "figma_integrations", fields: ["access_token", "refresh_token"] },
    { table: "posthog_integrations", fields: ["api_key"] },
    { table: "launchdarkly_integrations", fields: ["api_key"] },
    { table: "datadog_integrations", fields: ["api_key", "app_key"] },
    { table: "workos_integrations", fields: ["api_key", "webhook_secret"] },
    { table: "attio_integrations", fields: ["access_token"] }
    // Intentionally excluded: figma_webhooks.passcode
]

function printUsage(): void {
    console.log("Usage: pnpm run migrate:secrets [--dry-run] [--table=<table1,table2,...>]")
    console.log("")
    console.log("Options:")
    console.log("  --dry-run           Show what would migrate without writing to GSM or DB")
    console.log("  --table=<tables>    Comma-separated table names to migrate")
    console.log("  --help, -h          Show this help message")
}

function parseArgs(args: string[]): { dryRun: boolean; requestedTables: Set<string> | null; help: boolean } {
    let dryRun = false
    let help = false
    const requestedTables = new Set<string>()

    for (const arg of args) {
        if (arg === "--") {
            continue
        }
        if (arg === "--dry-run") {
            dryRun = true
            continue
        }
        if (arg === "--help" || arg === "-h") {
            help = true
            continue
        }
        if (arg.startsWith("--table=")) {
            const tables = arg
                .slice("--table=".length)
                .split(",")
                .map(value => value.trim())
                .filter(Boolean)
            for (const table of tables) {
                requestedTables.add(table)
            }
            continue
        }

        throw new Error(`Unknown argument: ${arg}`)
    }

    return {
        dryRun,
        requestedTables: requestedTables.size > 0 ? requestedTables : null,
        help
    }
}

function makeInitialStats(table: string): MigrationStats {
    return {
        table,
        rowsScanned: 0,
        columnsChecked: 0,
        eligibleColumns: 0,
        migratedColumns: 0,
        wouldMigrateColumns: 0,
        alreadyGsmColumns: 0,
        nullColumns: 0,
        nonStringColumns: 0,
        fallbackColumns: 0,
        errors: 0
    }
}

async function migrateTable(tableConfig: SecretTableConfig, dryRun: boolean): Promise<MigrationStats> {
    const prisma = db()
    const model = (prisma as Record<string, any>)[tableConfig.table]
    if (!model || typeof model.findMany !== "function" || typeof model.update !== "function") {
        throw new Error(`Prisma model not found or unsupported for table: ${tableConfig.table}`)
    }

    const stats = makeInitialStats(tableConfig.table)
    const select: Record<string, true> = { id: true }
    for (const field of tableConfig.fields) {
        select[field] = true
    }

    const rows: Array<{ id: string } & Record<string, unknown>> = await model.findMany({ select })
    stats.rowsScanned = rows.length

    for (const row of rows) {
        for (const field of tableConfig.fields) {
            stats.columnsChecked += 1

            const dbValue = row[field]
            if (dbValue === null || dbValue === undefined) {
                stats.nullColumns += 1
                continue
            }
            if (typeof dbValue !== "string") {
                stats.nonStringColumns += 1
                continue
            }
            if (dbValue === GSM_SENTINEL) {
                stats.alreadyGsmColumns += 1
                continue
            }

            stats.eligibleColumns += 1

            if (dryRun) {
                stats.wouldMigrateColumns += 1
                continue
            }

            try {
                const sentinel = await storeSecret(tableConfig.table, row.id, field, dbValue)
                if (sentinel !== GSM_SENTINEL) {
                    // storeSecret falls back to returning plaintext when GSM is unavailable.
                    stats.fallbackColumns += 1
                    continue
                }

                await model.update({
                    where: { id: row.id },
                    data: { [field]: sentinel }
                })
                stats.migratedColumns += 1
            } catch (error) {
                stats.errors += 1
                console.error(`[migrate-secrets] failed table=${tableConfig.table} id=${row.id} field=${field}`, error)
            }
        }
    }

    return stats
}

function printTableSummary(stats: MigrationStats, dryRun: boolean): void {
    console.log(
        `[migrate-secrets] table=${stats.table} rows=${stats.rowsScanned} checked=${stats.columnsChecked} eligible=${stats.eligibleColumns} ` +
            (dryRun ? `wouldMigrate=${stats.wouldMigrateColumns}` : `migrated=${stats.migratedColumns}`) +
            ` alreadyGsm=${stats.alreadyGsmColumns} null=${stats.nullColumns} nonString=${stats.nonStringColumns} fallback=${stats.fallbackColumns} errors=${stats.errors}`
    )
}

function printGlobalSummary(statsByTable: MigrationStats[], dryRun: boolean): void {
    const totals = statsByTable.reduce(
        (acc, stats) => {
            acc.rowsScanned += stats.rowsScanned
            acc.columnsChecked += stats.columnsChecked
            acc.eligibleColumns += stats.eligibleColumns
            acc.migratedColumns += stats.migratedColumns
            acc.wouldMigrateColumns += stats.wouldMigrateColumns
            acc.alreadyGsmColumns += stats.alreadyGsmColumns
            acc.nullColumns += stats.nullColumns
            acc.nonStringColumns += stats.nonStringColumns
            acc.fallbackColumns += stats.fallbackColumns
            acc.errors += stats.errors
            return acc
        },
        {
            rowsScanned: 0,
            columnsChecked: 0,
            eligibleColumns: 0,
            migratedColumns: 0,
            wouldMigrateColumns: 0,
            alreadyGsmColumns: 0,
            nullColumns: 0,
            nonStringColumns: 0,
            fallbackColumns: 0,
            errors: 0
        }
    )

    console.log("")
    console.log(
        `[migrate-secrets] completed tables=${statsByTable.length} rows=${totals.rowsScanned} checked=${totals.columnsChecked} eligible=${totals.eligibleColumns} ` +
            (dryRun ? `wouldMigrate=${totals.wouldMigrateColumns}` : `migrated=${totals.migratedColumns}`) +
            ` alreadyGsm=${totals.alreadyGsmColumns} null=${totals.nullColumns} nonString=${totals.nonStringColumns} fallback=${totals.fallbackColumns} errors=${totals.errors}`
    )
}

async function main(): Promise<void> {
    const { dryRun, requestedTables, help } = parseArgs(process.argv.slice(2))
    if (help) {
        printUsage()
        return
    }

    if (!dryRun && !isGsmAvailable()) {
        throw new Error("GSM is not configured (missing GCP_SERVICE_ACCOUNT_BASE64 or GCP_PROJECT_ID). Run with --dry-run or configure GSM first.")
    }

    if (requestedTables) {
        const knownTables = new Set(SECRET_TABLES.map(config => config.table))
        const unknownTables = Array.from(requestedTables).filter(table => !knownTables.has(table))
        if (unknownTables.length > 0) {
            throw new Error(`Unknown table(s): ${unknownTables.join(", ")}`)
        }
    }

    const tableConfigs = requestedTables ? SECRET_TABLES.filter(config => requestedTables.has(config.table)) : SECRET_TABLES
    if (tableConfigs.length === 0) {
        throw new Error("No matching tables selected. Check --table values.")
    }

    console.log(`[migrate-secrets] starting dryRun=${dryRun} tables=${tableConfigs.map(config => config.table).join(",")}`)

    const statsByTable: MigrationStats[] = []
    for (const tableConfig of tableConfigs) {
        const stats = await migrateTable(tableConfig, dryRun)
        statsByTable.push(stats)
        printTableSummary(stats, dryRun)
    }

    printGlobalSummary(statsByTable, dryRun)
}

main()
    .catch(error => {
        console.error("[migrate-secrets] failed", error)
        process.exit(1)
    })
    .finally(async () => {
        await db().$disconnect()
    })
