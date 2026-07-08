import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { DateTime } from "luxon"
import fs from "node:fs"
import type { CreateJobParameters } from "terse-sdk"
import { IntegrationType } from "terse-sdk"
import { ApiRoutes, hydrateSerializedEvent, toEventFixture } from "terse-types"
import type { SdkSampleEventsResponse, SerializedEvent } from "terse-types"

import { fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { assertProjectRoot } from "../assertProjectRoot.js"
import { CliError } from "../cliError.js"
import { isNonInteractive } from "../cliHelpers.js"
import { createRunIndicator, createSpinner, interceptConsole } from "../cliUi.js"
import { parseEventFixtureJson } from "../eventFixture.js"
import { loadJob } from "../loadJob.js"
import { readProjectConfig, readProjectConfigOrBail } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { remoteDispatchNotice, runLocalTestJob } from "../runLocalTestJob.js"

export async function test(jobName?: string, verbose?: boolean, provider: LanguageProvider = resolveProvider(), entryFile?: string): Promise<void> {
    if (isNonInteractive()) {
        throw new CliError("test_requires_interactive", "`terse test` needs a terminal.", {
            detail: "In non-interactive contexts, use `terse test list` to enumerate sample events and `terse test run --id <id>` to execute one."
        })
    }

    intro("terse test")
    assertProjectRoot(provider)

    const { job } = await loadJob(provider, jobName, entryFile)

    const apiKey = readApiKeyOrBail({
        title: "Error: Not authenticated. Unable to fetch sample events.",
        detail: "Run `terse auth login` to authenticate, or set TERSE_API_KEY in your environment."
    })

    const spinner = createSpinner()
    spinner.start("Fetching sample events")
    let candidates: SampleEventCandidate[] = []
    let webhookEndpoints: SampleEventCandidatesResult["webhookEndpoints"] = []
    try {
        const result = await fetchSampleEventCandidatesForJob(job, apiKey)
        candidates = result.candidates
        webhookEndpoints = result.webhookEndpoints
        spinner.stop(`Fetched ${candidates.length} sample event${candidates.length === 1 ? "" : "s"}`)
    } catch (err) {
        spinner.stop(err instanceof Error ? err.message : "Failed to fetch sample events.")
    }

    if (candidates.length === 0) {
        if (webhookEndpoints.length > 0) {
            log.info(emptyWebhookCurlHint(job.name, webhookEndpoints))
            outro("Done")
            return
        }
        throw new CliError("no_sample_events", "No sample events available.", {
            detail: "Make sure your triggers are configured and events have been received."
        })
    }

    log.info(`Testing job ${chalk.cyan(job.name)} on the ${chalk.cyan(provider.runtimeName(job))} runtime`)

    const event = await chooseSampleEvent(candidates, apiKey)

    const projectId = readProjectConfigOrBail().projectId
    const runView = createRunIndicator(`Running ${formatEventLabel(event)}`)
    const restoreConsole = interceptConsole(line => runView.logLine(line))
    runView.start()
    try {
        const { runId, local } = await runLocalTestJob(provider, job, event, {
            projectId,
            apiKey,
            verbose: !!verbose,
            entryFile,
            pauseUiAround: async fn => {
                runView.pause("Awaiting input")
                try {
                    return await fn()
                } finally {
                    runView.start()
                }
            }
        })
        restoreConsole()
        if (local) runView.succeed("Run completed")
        else runView.succeed(remoteDispatchNotice(runId))
        outro("Done")
    } catch (error) {
        restoreConsole()
        runView.fail("Run failed")
        throw error
    }
}

export async function testList(opts: TestListOpts = {}): Promise<void> {
    const provider = opts.provider ?? resolveProvider()
    assertProjectRoot(provider)

    const { job } = await loadJob(provider, opts.jobName, opts.entryFile, { nonInteractive: true })
    const apiKey = readApiKeyOrBail()

    const { candidates, webhookEndpoints } = await fetchSampleEventCandidatesForJob(job, apiKey)

    if (opts.json) {
        const payload = {
            job: job.name,
            events: candidates.map(candidate => ({
                id: candidate.id,
                integrationType: candidate.integrationType,
                eventType: candidate.eventType,
                label: candidate.label,
                subtitle: candidate.subtitle,
                entityType: candidate.kind === "ref" ? candidate.entityType : null,
                entityId: candidate.kind === "ref" ? candidate.entityId : null
            })),
            webhookEndpoints
        }
        process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
        return
    }

    if (candidates.length === 0) {
        if (webhookEndpoints.length > 0) {
            process.stdout.write(emptyWebhookCurlHint(job.name, webhookEndpoints) + "\n")
        } else {
            process.stdout.write("No sample events available.\n")
        }
        return
    }

    process.stdout.write(`Sample events for job ${job.name}:\n\n`)
    for (const candidate of candidates) {
        const subtitle = candidate.subtitle ? ` — ${normalizeSingleLine(candidate.subtitle)}` : ""
        process.stdout.write(`  ${chalk.cyan(candidate.id)}  ${candidate.integrationType}/${candidate.eventType}  ${candidate.label}${chalk.dim(subtitle)}\n`)
    }
    process.stdout.write("\n")
    process.stdout.write(chalk.dim(`Run one with:  terse test run --id <id>\n`))
}

export async function testShow(opts: TestShowOpts): Promise<void> {
    const provider = opts.provider ?? resolveProvider()
    assertProjectRoot(provider)

    const event = await resolveEventById(provider, opts.id, opts.jobName, opts.entryFile)

    if (opts.json) {
        process.stdout.write(JSON.stringify({ id: opts.id, event: toEventFixture(event) }, null, 2) + "\n")
        return
    }

    process.stdout.write(`${chalk.bold(formatEventLabel(event))}\n`)
    if (event.display?.subtitle) process.stdout.write(chalk.dim(event.display.subtitle) + "\n")
    process.stdout.write(`\n${event.formattedContent}\n`)
}

export async function testRun(opts: TestRunOpts): Promise<void> {
    const provider = opts.provider ?? resolveProvider()
    assertProjectRoot(provider)

    const modeCount = [opts.id, opts.eventJson, opts.eventFile].filter(Boolean).length
    if (modeCount === 0) {
        throw new CliError("missing_event", "Provide one of --id, --event, or --event-file.", {
            detail: "Run `terse test list --json` to see available sample ids."
        })
    }
    if (modeCount > 1) {
        throw new CliError("conflicting_flags", "--id, --event, and --event-file are mutually exclusive.")
    }

    const { job } = await loadJob(provider, opts.jobName, opts.entryFile, { nonInteractive: true })

    let event: SerializedEvent
    if (opts.id) {
        event = await resolveEventByIdForJob(job, opts.id)
    } else {
        const rawJson = opts.eventJson ?? readEventFile(opts.eventFile!)
        event = parseEventFixtureJson(rawJson, "--event / --event-file")
    }

    const apiKey = readApiKeyOrBail()
    const projectId = readProjectConfigOrBail().projectId
    const { runId, local } = await runLocalTestJob(provider, job, event, { projectId, apiKey, verbose: !!opts.verbose, entryFile: opts.entryFile })
    if (!local) console.log(chalk.cyan(`  ${remoteDispatchNotice(runId)}`))
}

async function resolveEventById(provider: LanguageProvider, id: string, jobNameHint: string | undefined, entryFile: string | undefined): Promise<SerializedEvent> {
    const { job } = await loadJob(provider, jobNameHint, entryFile, { nonInteractive: true })
    return resolveEventByIdForJob(job, id)
}

async function resolveEventByIdForJob(job: CreateJobParameters, id: string): Promise<SerializedEvent> {
    const apiKey = readApiKeyOrBail()
    const { candidates } = await fetchSampleEventCandidatesForJob(job, apiKey)
    const match = candidates.find(candidate => candidate.id === id)
    if (match) return hydrateCandidateEvent(match, apiKey)

    throw new CliError("sample_not_found", `No sample event matches id ${id}.`, {
        detail: "Run `terse test list` to refresh — the event may have rotated out of the sample buffer."
    })
}

function readEventFile(filePath: string): string {
    try {
        return fs.readFileSync(filePath, "utf-8")
    } catch (err) {
        throw new CliError("event_file_unreadable", `Could not read event file: ${filePath}`, {
            detail: err instanceof Error ? err.message : String(err)
        })
    }
}

async function fetchSampleEventCandidatesForJob(job: CreateJobParameters, apiKey: string): Promise<SampleEventCandidatesResult> {
    const timeTriggers = job.triggers.filter(t => t.integrationType === IntegrationType.CRON_JOB)
    const sampleEventTriggers = job.triggers.filter(t => t.integrationType !== IntegrationType.CRON_JOB)

    const candidates: SampleEventCandidate[] = []
    const webhookEndpoints: NonNullable<SdkSampleEventsResponse["webhookEndpoints"]> = []

    if (sampleEventTriggers.length > 0) {
        const projectId = readProjectConfig()?.projectId
        const result = await fetchWithAuth<SdkSampleEventsResponse>(
            ApiRoutes.SDK.SAMPLE_EVENTS,
            apiKey,
            {
                projectId,
                jobName: job.name,
                triggers: sampleEventTriggers.map(trigger => ({
                    triggerId: undefined,
                    integrationId: trigger.integrationId,
                    integrationType: trigger.integrationType,
                    config: trigger
                }))
            },
            "POST"
        )
        let storedIndex = 0
        for (const event of result.events) {
            if (event.entity) {
                candidates.push({
                    id: encodeRefId(event.entity.entityType, event.entity.entityId),
                    kind: "ref",
                    integrationType: event.serializedEvent.integrationType,
                    eventType: event.serializedEvent.eventType,
                    label: normalizeSingleLine(event.serializedEvent.display?.title || `${event.serializedEvent.integrationType} / ${event.serializedEvent.eventType}`),
                    subtitle: event.serializedEvent.display?.subtitle ?? null,
                    entityType: event.entity.entityType,
                    entityId: event.entity.entityId
                })
            } else {
                const time = event.recordedAt ? (DateTime.fromISO(event.recordedAt).toRelative() ?? null) : null
                const method = event.serializedEvent.display?.subtitle ?? null
                const labelParts = [event.serializedEvent.integrationType === IntegrationType.WEBHOOK ? "Webhook" : event.serializedEvent.integrationType, method, time].filter(Boolean) as string[]
                candidates.push({
                    id: `stored:${storedIndex++}`,
                    kind: "stored",
                    integrationType: event.serializedEvent.integrationType,
                    eventType: event.serializedEvent.eventType,
                    label: labelParts.join(" · "),
                    subtitle: event.serializedEvent.display?.subtitle ?? null,
                    recordedAt: event.recordedAt ?? null,
                    event: event.serializedEvent
                })
            }
        }
        if (result.webhookEndpoints) webhookEndpoints.push(...result.webhookEndpoints)
    }

    for (const [index, trigger] of timeTriggers.entries()) {
        const event = hydrateSerializedEvent({
            integrationType: IntegrationType.CRON_JOB,
            eventType: "cron",
            inputId: trigger.integrationId,
            isManualTrigger: true,
            manualContext: `Manual trigger from terse test (schedule: ${trigger.cronExpression})`
        })
        candidates.push({
            id: `synthetic:cron:${index}`,
            kind: "synthetic",
            integrationType: event.integrationType,
            eventType: event.eventType,
            label: formatEventLabel(event),
            subtitle: event.display?.subtitle ?? null,
            event
        })
    }

    return { candidates, webhookEndpoints }
}

function formatEventLabel(event: SerializedEvent): string {
    return normalizeSingleLine(event.display?.title || `${event.integrationType} / ${event.eventType}`)
}

function formatEventHint(candidate: SampleEventCandidate): string {
    if (candidate.kind === "stored") {
        const preview = previewPayload(candidate.event)
        if (preview) return truncate(preview, 120)
        if (candidate.subtitle) return truncate(normalizeSingleLine(candidate.subtitle), 120)
        return truncate(`${candidate.integrationType}/${candidate.eventType}`, 120)
    }
    if (candidate.subtitle) return truncate(normalizeSingleLine(candidate.subtitle), 120)
    if (candidate.kind === "ref") return truncate(`${candidate.integrationType}/${candidate.eventType}`, 120)
    return "Synthetic sample event"
}

function previewPayload(event: SerializedEvent): string | null {
    const data = event.data as Record<string, unknown> | undefined
    const body = data && "body" in data ? data.body : data
    if (body == null) return null
    try {
        return normalizeSingleLine(JSON.stringify(body))
    } catch {
        return null
    }
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value
    }

    return `${value.slice(0, maxLength - 1)}…`
}

function normalizeSingleLine(value: string): string {
    return value
        .replace(/\s*\n+\s*/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function abortIfCancelled<T>(value: T | symbol): T {
    if (isCancel(value)) {
        cancel("Operation cancelled.")
        process.exit(0)
    }

    return value as T
}

async function chooseSampleEvent(candidates: SampleEventCandidate[], apiKey: string): Promise<SerializedEvent> {
    while (true) {
        const choice = abortIfCancelled(
            await select<number>({
                message: "Choose a sample event",
                options: candidates.map((candidate, index) => ({
                    label: `${candidate.label} ${chalk.dim("›")}`,
                    hint: formatEventHint(candidate),
                    value: index
                }))
            })
        )

        const event = await hydrateCandidateEvent(candidates[choice], apiKey)
        const action = await inspectSampleEvent(event)
        if (action === "run") {
            return event
        }
    }
}

async function hydrateCandidateEvent(candidate: SampleEventCandidate, apiKey: string): Promise<SerializedEvent> {
    if (candidate.kind === "synthetic" || candidate.kind === "stored") {
        return candidate.event
    }
    const payload = await fetchWithAuth<{ event: SerializedEvent }>(ApiRoutes.SDK.HYDRATE_SAMPLE_EVENT, apiKey, { entityType: candidate.entityType, entityId: candidate.entityId }, "POST")
    return payload.event
}

function encodeRefId(entityType: string, entityId: string): string {
    const token = Buffer.from(JSON.stringify({ entityType, entityId }), "utf8").toString("base64url")
    return `ref:${token}`
}

function emptyWebhookCurlHint(jobName: string, endpoints: NonNullable<SdkSampleEventsResponse["webhookEndpoints"]>): string {
    const lines = [`No past webhook events for ${chalk.cyan(jobName)} yet. Trigger one with:`, ""]
    for (const { webhookUrl } of endpoints) {
        lines.push(`  curl -X POST ${chalk.cyan(webhookUrl)} \\`)
        lines.push(`    -H 'Content-Type: application/json' \\`)
        lines.push(`    -d '{ "your": "payload" }'`)
        lines.push("")
    }
    lines.push(chalk.dim("After the first event lands, `terse test` will pick it up automatically."))
    return lines.join("\n")
}

async function inspectSampleEvent(event: SerializedEvent): Promise<"back" | "run"> {
    log.info(chalk.bold(formatEventLabel(event)))
    if (event.display?.subtitle) {
        console.log(chalk.dim(event.display.subtitle))
    }
    console.log("")
    console.log(chalk.dim(truncate(normalizeSingleLine(event.formattedContent), 300)))
    console.log("")

    return abortIfCancelled(
        await select<"back" | "run">({
            message: "Run this event?",
            options: [
                { label: "Run this sample event", value: "run" },
                { label: "Choose another event", value: "back" }
            ]
        })
    )
}

// Types

export type TestListOpts = {
    jobName?: string
    json?: boolean
    entryFile?: string
    provider?: LanguageProvider
}

export type TestShowOpts = {
    id: string
    jobName?: string
    json?: boolean
    entryFile?: string
    provider?: LanguageProvider
}

export type TestRunOpts = {
    jobName?: string
    id?: string
    eventJson?: string
    eventFile?: string
    verbose?: boolean
    entryFile?: string
    provider?: LanguageProvider
}

type SampleEventCandidate =
    | {
          id: string
          kind: "ref"
          integrationType: string
          eventType: string
          label: string
          subtitle: string | null
          entityType: string
          entityId: string
      }
    | {
          id: string
          kind: "synthetic"
          integrationType: string
          eventType: string
          label: string
          subtitle: string | null
          event: SerializedEvent
      }
    | {
          id: string
          kind: "stored"
          integrationType: string
          eventType: string
          label: string
          subtitle: string | null
          recordedAt: string | null
          event: SerializedEvent
      }

type SampleEventCandidatesResult = {
    candidates: SampleEventCandidate[]
    webhookEndpoints: NonNullable<SdkSampleEventsResponse["webhookEndpoints"]>
}
