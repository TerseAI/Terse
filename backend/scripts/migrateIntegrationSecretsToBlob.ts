/**
 * One-shot migration: convert per-field GSM secrets to per-record JSON-blob secrets.
 *
 * Old layout: `<integration_type>-<recordId>-<snake_case_field>`, one GSM secret per field.
 * New layout: `<integration_type>-<recordId>`,                    one GSM secret holding `{ [camelCaseField]: value }`.
 *
 * Run pre-deploy:
 *   pnpm tsx backend/scripts/migrateIntegrationSecretsToBlob.ts             # write new blobs (idempotent)
 *   pnpm tsx backend/scripts/migrateIntegrationSecretsToBlob.ts --dry-run   # report only, no writes
 *   pnpm tsx backend/scripts/migrateIntegrationSecretsToBlob.ts --delete-old # after new code is stable, delete the legacy per-field secrets
 */

import { IntegrationType } from "terse-types/Integrations"

import { db } from "../src/prismaClient"
import { getSecretManagerClient } from "../src/utility/secretManagerClient"

type FieldMapping = { legacy: string; blob: string }

type IntegrationKind = {
    label: string
    integrationType: Exclude<IntegrationType, IntegrationType.TERSE | IntegrationType.CRON_JOB>
    fields: FieldMapping[]
    listIds: () => Promise<string[]>
}

const ACCESS = { legacy: "access_token", blob: "accessToken" }
const REFRESH = { legacy: "refresh_token", blob: "refreshToken" }
const API_KEY = { legacy: "api_key", blob: "apiKey" }
const APP_KEY = { legacy: "app_key", blob: "appKey" }
const WEBHOOK_SECRET = { legacy: "webhook_secret", blob: "webhookSecret" }
const AUTHED_USER_ACCESS = { legacy: "authed_user_access_token", blob: "authedUserAccessToken" }
const PRIVATE_KEY = { legacy: "private_key", blob: "privateKey" }
const PRIVATE_KEY_PASSPHRASE = { legacy: "private_key_passphrase", blob: "privateKeyPassphrase" }
const INTEGRATION_TOKEN = { legacy: "integration_token", blob: "integrationToken" }

const KINDS: IntegrationKind[] = [
    { label: "attio_integrations", integrationType: IntegrationType.ATTIO, fields: [ACCESS], listIds: async () => (await db().attio_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "workos_integrations", integrationType: IntegrationType.WORKOS, fields: [API_KEY, WEBHOOK_SECRET], listIds: async () => (await db().workos_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "github_app_tokens", integrationType: IntegrationType.GITHUB, fields: [ACCESS, REFRESH], listIds: async () => (await db().github_app_tokens.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "datadog_integrations", integrationType: IntegrationType.DATADOG, fields: [API_KEY, APP_KEY], listIds: async () => (await db().datadog_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "hey_reach_integrations", integrationType: IntegrationType.HEY_REACH, fields: [API_KEY], listIds: async () => (await db().hey_reach_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "slack_integrations", integrationType: IntegrationType.SLACK, fields: [ACCESS], listIds: async () => (await db().slack_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "user_slack_integrations", integrationType: IntegrationType.SLACK, fields: [AUTHED_USER_ACCESS], listIds: async () => (await db().user_slack_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "posthog_integrations", integrationType: IntegrationType.POSTHOG, fields: [API_KEY], listIds: async () => (await db().posthog_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "snowflake_integrations", integrationType: IntegrationType.SNOWFLAKE, fields: [PRIVATE_KEY, PRIVATE_KEY_PASSPHRASE], listIds: async () => (await db().snowflake_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "gmail_integrations", integrationType: IntegrationType.GMAIL, fields: [ACCESS, REFRESH], listIds: async () => (await db().gmail_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "linear_integrations", integrationType: IntegrationType.LINEAR, fields: [ACCESS, REFRESH], listIds: async () => (await db().linear_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "launchdarkly_integrations", integrationType: IntegrationType.LAUNCHDARKLY, fields: [API_KEY], listIds: async () => (await db().launchdarkly_integrations.findMany({ select: { id: true } })).map(r => r.id) },
    { label: "notion_integrations", integrationType: IntegrationType.NOTION, fields: [INTEGRATION_TOKEN], listIds: async () => (await db().notion_integrations.findMany({ select: { id: true } })).map(r => r.id) }
]

const argv = new Set(process.argv.slice(2))
const dryRun = argv.has("--dry-run")
const deleteOld = argv.has("--delete-old")

function sanitize(component: string): string {
    return component.replace(/[^a-zA-Z0-9_-]/g, "-")
}

function buildBlobId(integrationType: string, recordId: string): string {
    return [sanitize(integrationType), sanitize(recordId)].join("-").slice(0, 255)
}

function buildLegacyFieldId(integrationType: string, recordId: string, legacyField: string): string {
    return [sanitize(integrationType), sanitize(recordId), sanitize(legacyField)].join("-").slice(0, 255)
}

type PerRecordReport = {
    integrationType: string
    recordId: string
    blobId: string
    fieldsFound: string[]
    fieldsMissing: string[]
    wrote: boolean
    deletedOld: string[]
    failures: { stage: string; field?: string; error: string }[]
}

async function main(): Promise<void> {
    const client = getSecretManagerClient()
    const allReports: PerRecordReport[] = []

    for (const kind of KINDS) {
        const ids = await kind.listIds()
        console.log(`[${kind.label}] ${ids.length} records`)

        for (const recordId of ids) {
            const blobId = buildBlobId(kind.integrationType, recordId)
            const report: PerRecordReport = {
                integrationType: kind.integrationType,
                recordId,
                blobId,
                fieldsFound: [],
                fieldsMissing: [],
                wrote: false,
                deletedOld: [],
                failures: []
            }

            const blob: Record<string, string> = {}
            for (const field of kind.fields) {
                const legacyId = buildLegacyFieldId(kind.integrationType, recordId, field.legacy)
                try {
                    const value = await client.getSecretOrNull(legacyId)
                    if (value === null) {
                        report.fieldsMissing.push(field.legacy)
                    } else {
                        blob[field.blob] = value
                        report.fieldsFound.push(field.legacy)
                    }
                } catch (error) {
                    report.failures.push({ stage: "read-legacy", field: field.legacy, error: (error as Error).message })
                }
            }

            if (Object.keys(blob).length === 0) {
                allReports.push(report)
                continue
            }

            if (!dryRun) {
                try {
                    await client.createOrUpdateSecret(blobId, JSON.stringify(blob))
                    report.wrote = true
                } catch (error) {
                    report.failures.push({ stage: "write-blob", error: (error as Error).message })
                }
            }

            if (deleteOld && report.wrote) {
                for (const legacyField of report.fieldsFound) {
                    const legacyId = buildLegacyFieldId(kind.integrationType, recordId, legacyField)
                    try {
                        await client.deleteSecret(legacyId)
                        report.deletedOld.push(legacyField)
                    } catch (error) {
                        report.failures.push({ stage: "delete-legacy", field: legacyField, error: (error as Error).message })
                    }
                }
            }

            allReports.push(report)
        }
    }

    const totals = {
        records: allReports.length,
        wrote: allReports.filter(r => r.wrote).length,
        skippedEmpty: allReports.filter(r => r.fieldsFound.length === 0).length,
        withFailures: allReports.filter(r => r.failures.length > 0).length,
        deletedLegacy: allReports.reduce((acc, r) => acc + r.deletedOld.length, 0)
    }

    console.log("\n=== summary ===")
    console.log(`mode:              ${dryRun ? "DRY-RUN" : "WRITE"}${deleteOld ? " + DELETE-OLD" : ""}`)
    console.log(`records scanned:   ${totals.records}`)
    console.log(`blobs written:     ${totals.wrote}`)
    console.log(`empty records:     ${totals.skippedEmpty}`)
    console.log(`legacy deleted:    ${totals.deletedLegacy}`)
    console.log(`records w/ errs:   ${totals.withFailures}`)

    if (totals.withFailures > 0) {
        console.log("\n=== failures ===")
        for (const r of allReports) {
            if (r.failures.length === 0) continue
            console.log(`${r.integrationType}/${r.recordId}:`)
            for (const f of r.failures) {
                console.log(`  ${f.stage}${f.field ? ` ${f.field}` : ""}: ${f.error}`)
            }
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err)
        process.exit(1)
    })
