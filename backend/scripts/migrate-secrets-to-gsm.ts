import "dotenv/config"

import { db } from "../src/prismaClient"
import { isGsmAvailable, storeSecret, SecretTable, SecretField } from "../src/services/SecretService"
import { IntegrationType } from "../src/shared/Integrations"

type SecretTableConfig = {
    /** The Prisma model name (matches the DB table) used to read rows. */
    prismaModel: string
    /** The IntegrationType used as the secret key prefix in GSM. */
    secretTable: SecretTable
    fields: SecretField[]
}

type MigrationStats = {
    table: string
    rowsScanned: number
    columnsChecked: number
    eligibleColumns: number
    migratedColumns: number
    wouldMigrateColumns: number
    nullColumns: number
    nonStringColumns: number
    errors: number
}

const SECRET_TABLES: SecretTableConfig[] = [
    { prismaModel: "github_app_tokens", secretTable: IntegrationType.GITHUB, fields: [SecretField.AccessToken, SecretField.RefreshToken] },
    { prismaModel: "linear_integrations", secretTable: IntegrationType.LINEAR, fields: [SecretField.AccessToken, SecretField.RefreshToken] },
    { prismaModel: "user_slack_integrations", secretTable: IntegrationType.SLACK, fields: [SecretField.AuthedUserAccessToken] },
    { prismaModel: "slack_integrations", secretTable: IntegrationType.SLACK, fields: [SecretField.AccessToken] },
    { prismaModel: "atlassian_integrations", secretTable: IntegrationType.ATLASSIAN, fields: [SecretField.AccessToken, SecretField.RefreshToken, SecretField.WebhookSecret] },
    { prismaModel: "gmail_integrations", secretTable: IntegrationType.GMAIL, fields: [SecretField.AccessToken, SecretField.RefreshToken] },
    { prismaModel: "notion_integrations", secretTable: IntegrationType.NOTION, fields: [SecretField.IntegrationToken] },
    { prismaModel: "figma_integrations", secretTable: IntegrationType.FIGMA, fields: [SecretField.AccessToken, SecretField.RefreshToken] },
    { prismaModel: "posthog_integrations", secretTable: IntegrationType.POSTHOG, fields: [SecretField.ApiKey] },
    { prismaModel: "launchdarkly_integrations", secretTable: IntegrationType.LAUNCHDARKLY, fields: [SecretField.ApiKey] },
    { prismaModel: "datadog_integrations", secretTable: IntegrationType.DATADOG, fields: [SecretField.ApiKey, SecretField.AppKey] },
    { prismaModel: "workos_integrations", secretTable: IntegrationType.WORKOS, fields: [SecretField.ApiKey, SecretField.WebhookSecret] },
    { prismaModel: "attio_integrations", secretTable: IntegrationType.ATTIO, fields: [SecretField.AccessToken] }
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
        nullColumns: 0,
        nonStringColumns: 0,
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

            stats.eligibleColumns += 1

            if (dryRun) {
                stats.wouldMigrateColumns += 1
                continue
            }

            try {
                await storeSecret(tableConfig.table, row.id, field, dbValue)
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
            ` null=${stats.nullColumns} nonString=${stats.nonStringColumns} errors=${stats.errors}`
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
            acc.nullColumns += stats.nullColumns
            acc.nonStringColumns += stats.nonStringColumns
            acc.errors += stats.errors
            return acc
        },
        {
            rowsScanned: 0,
            columnsChecked: 0,
            eligibleColumns: 0,
            migratedColumns: 0,
            wouldMigrateColumns: 0,
            nullColumns: 0,
            nonStringColumns: 0,
            errors: 0
        }
    )

    console.log("")
    console.log(
        `[migrate-secrets] completed tables=${statsByTable.length} rows=${totals.rowsScanned} checked=${totals.columnsChecked} eligible=${totals.eligibleColumns} ` +
            (dryRun ? `wouldMigrate=${totals.wouldMigrateColumns}` : `migrated=${totals.migratedColumns}`) +
            ` null=${totals.nullColumns} nonString=${totals.nonStringColumns} errors=${totals.errors}`
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
