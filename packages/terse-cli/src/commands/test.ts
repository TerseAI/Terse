import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts"
import chalk from "chalk"
import fs from "node:fs"
import type { CreateJobParameters } from "terse-sdk"
import { IntegrationType } from "terse-sdk"
import { ApiRoutes, debugTrigger, displayTrigger, formatTriggerForAgent, serializedEventSchema } from "terse-types"
import type { SerializedEvent, Trigger } from "terse-types"

import { fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { assertProjectRoot } from "../assertProjectRoot.js"
import { CliError } from "../cliError.js"
import { isNonInteractive } from "../cliHelpers.js"
import { createSpinner } from "../cliUi.js"
import { loadJob } from "../loadJob.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { readCachedEvent, writeCachedEvents } from "../sampleEventCache.js"
import { hashEventKey } from "../sampleEventId.js"

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
        detail: "Run `terse login` to authenticate, or set TERSE_API_KEY in your environment."
    })

    const spinner = createSpinner()
    spinner.start("Fetching sample events")
    let events: SerializedEvent[] = []
    try {
        events = await fetchSampleEventsForJob(job, apiKey)
        spinner.stop(`Fetched ${events.length} sample event${events.length === 1 ? "" : "s"}`)
    } catch (err) {
        spinner.stop(err instanceof Error ? err.message : "Failed to fetch sample events.")
    }

    if (events.length === 0) {
        log.error("No sample events available. Make sure your triggers are configured and events have been received.")
        process.exit(1)
    }

    writeCachedEvents(job.name, events)

    log.info(`Testing job ${chalk.cyan(job.name)}`)

    const choice = await chooseSampleEvent(events)

    const runSpinner = createSpinner()
    runSpinner.start(`Running ${formatEventLabel(events[choice])}`)
    try {
        await provider.executeJob(job, null, events[choice], { verbose: !!verbose, entryFile })
        runSpinner.stop("Run completed")
        outro("Done")
    } catch (error) {
        runSpinner.stop("Run failed")
        throw error
    }
}

export type TestListOpts = {
    jobName?: string
    json?: boolean
    entryFile?: string
    provider?: LanguageProvider
}

export async function testList(opts: TestListOpts = {}): Promise<void> {
    const provider = opts.provider ?? resolveProvider()
    assertProjectRoot(provider)

    const { job } = await loadJob(provider, opts.jobName, opts.entryFile, { nonInteractive: true })
    const apiKey = readApiKeyOrBail()

    const events = await fetchSampleEventsForJob(job, apiKey)
    writeCachedEvents(job.name, events)

    if (opts.json) {
        const payload = {
            job: job.name,
            events: events.map(event => ({
                id: hashEventKey(event),
                integrationType: event.integrationType,
                eventType: event.eventType,
                label: formatEventLabel(event),
                subtitle: event.display?.subtitle ?? null,
                event
            }))
        }
        process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
        return
    }

    if (events.length === 0) {
        process.stdout.write("No sample events available.\n")
        return
    }

    process.stdout.write(`Sample events for job ${job.name}:\n\n`)
    for (const event of events) {
        const id = hashEventKey(event)
        const label = formatEventLabel(event)
        const subtitle = event.display?.subtitle ? ` — ${normalizeSingleLine(event.display.subtitle)}` : ""
        process.stdout.write(`  ${chalk.cyan(id)}  ${event.integrationType}/${event.eventType}  ${label}${chalk.dim(subtitle)}\n`)
    }
    process.stdout.write("\n")
    process.stdout.write(chalk.dim(`Run one with:  terse test run --id <id>\n`))
}

export type TestShowOpts = {
    id: string
    jobName?: string
    json?: boolean
    entryFile?: string
    provider?: LanguageProvider
}

export async function testShow(opts: TestShowOpts): Promise<void> {
    const provider = opts.provider ?? resolveProvider()
    assertProjectRoot(provider)

    const event = await resolveEventById(provider, opts.id, opts.jobName, opts.entryFile)

    if (opts.json) {
        process.stdout.write(JSON.stringify({ id: opts.id, event }, null, 2) + "\n")
        return
    }

    process.stdout.write(`${chalk.bold(formatEventLabel(event))}\n`)
    if (event.display?.subtitle) process.stdout.write(chalk.dim(event.display.subtitle) + "\n")
    process.stdout.write(`\n${event.formattedContent}\n`)
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
        event = parseEventJson(rawJson)
    }

    await provider.executeJob(job, null, event, { verbose: !!opts.verbose, entryFile: opts.entryFile })
}

async function resolveEventById(provider: LanguageProvider, id: string, jobNameHint: string | undefined, entryFile: string | undefined): Promise<SerializedEvent> {
    const { job } = await loadJob(provider, jobNameHint, entryFile, { nonInteractive: true })
    return resolveEventByIdForJob(job, id)
}

async function resolveEventByIdForJob(job: CreateJobParameters, id: string): Promise<SerializedEvent> {
    const cached = readCachedEvent(id, job.name)
    if (cached) return cached

    const apiKey = readApiKeyOrBail()
    const events = await fetchSampleEventsForJob(job, apiKey)
    writeCachedEvents(job.name, events)
    const match = events.find(event => hashEventKey(event) === id)
    if (match) return match

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

function parseEventJson(raw: string): SerializedEvent {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch (err) {
        throw new CliError("invalid_event_json", "--event / --event-file must be valid JSON.", {
            detail: err instanceof Error ? err.message : String(err)
        })
    }
    try {
        return serializedEventSchema.parse(parsed)
    } catch (err) {
        throw new CliError("invalid_event_shape", "Event JSON does not match the canonical Trigger schema.", {
            detail: err instanceof Error ? err.message : String(err)
        })
    }
}

export async function fetchSampleEventsForJob(job: CreateJobParameters, apiKey: string): Promise<SerializedEvent[]> {
    const timeTriggers = job.triggers.filter(t => t.integrationType === IntegrationType.CRON_JOB)
    const webhookTriggers = job.triggers.filter(t => t.integrationType === IntegrationType.WEBHOOK)
    const integrationTriggers = job.triggers.filter(t => t.integrationType !== IntegrationType.CRON_JOB && t.integrationType !== IntegrationType.WEBHOOK)

    const events: SerializedEvent[] = []

    if (integrationTriggers.length > 0) {
        const result = await fetchWithAuth<{ events: SerializedEvent[] }>(
            ApiRoutes.SDK.SAMPLE_EVENTS,
            apiKey,
            {
                triggers: integrationTriggers.map(trigger => ({
                    triggerId: undefined,
                    integrationId: trigger.integrationId,
                    integrationType: trigger.integrationType,
                    config: trigger
                }))
            },
            "POST"
        )
        events.push(...result.events)
    }

    for (const [index, trigger] of timeTriggers.entries()) {
        events.push(
            serializeEvent({
                integrationType: IntegrationType.CRON_JOB,
                eventType: "cron",
                inputId: trigger.integrationId,
                isManualTrigger: true,
                manualContext: `Manual trigger from terse test (schedule: ${trigger.cronExpression})`
            })
        )
    }

    for (const [index] of webhookTriggers.entries()) {
        events.push(
            serializeEvent({
                integrationType: IntegrationType.WEBHOOK,
                eventType: "webhook",
                body: {},
                headers: {},
                method: "POST"
            })
        )
    }

    return events
}

function formatEventLabel(event: SerializedEvent): string {
    return normalizeSingleLine(event.display?.title || `${event.integrationType} / ${event.eventType}`)
}

function formatEventHint(event: SerializedEvent): string {
    return truncate(normalizeSingleLine(event.display?.subtitle || event.debugLog), 120)
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

async function chooseSampleEvent(events: SerializedEvent[]): Promise<number> {
    while (true) {
        const choice = abortIfCancelled(
            await select<number>({
                message: "Choose a sample event",
                options: events.map((event, index) => ({
                    label: `${formatEventLabel(event)} ${chalk.dim("›")}`,
                    hint: formatEventHint(event),
                    value: index
                }))
            })
        )

        const action = await inspectSampleEvent(events[choice])
        if (action === "run") {
            return choice
        }
    }
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

function serializeEvent(event: Trigger): SerializedEvent {
    return {
        integrationType: event.integrationType,
        eventType: event.eventType,
        formattedContent: formatTriggerForAgent(event),
        debugLog: debugTrigger(event),
        display: displayTrigger(event),
        data: event
    }
}
