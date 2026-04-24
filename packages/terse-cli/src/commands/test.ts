import { cancel, intro, isCancel, log, outro, select } from "@clack/prompts"
import chalk from "chalk"
import { IntegrationType } from "terse-sdk"
import { ApiRoutes, debugTrigger, displayTrigger, formatTriggerForAgent } from "terse-types"
import type { SerializedEvent, Trigger } from "terse-types"

import { fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { assertProjectRoot } from "../assertProjectRoot.js"
import { createSpinner } from "../cliUi.js"
import { loadJob } from "../loadJob.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function test(jobName?: string, verbose?: boolean, provider: LanguageProvider = resolveProvider(), entryFile?: string): Promise<void> {
    intro("terse test")
    assertProjectRoot(provider)

    const { job } = await loadJob(provider, jobName, entryFile)

    const apiKey = readApiKeyOrBail({
        title: "Error: Not authenticated. Unable to fetch sample events.",
        detail: "Run `terse login` to authenticate, or set TERSE_API_KEY in your environment."
    })

    // Split triggers into time-based, webhook, and integration-based
    const timeTriggers = job.triggers.filter(t => t.integrationType === IntegrationType.CRON_JOB)
    const webhookTriggers = job.triggers.filter(t => t.integrationType === IntegrationType.WEBHOOK)
    const integrationTriggers = job.triggers.filter(t => t.integrationType !== IntegrationType.CRON_JOB && t.integrationType !== IntegrationType.WEBHOOK)

    let events: SerializedEvent[] = []

    // Fetch sample events for integration triggers (time triggers have no sample events)
    if (integrationTriggers.length > 0) {
        const spinner = createSpinner()
        spinner.start("Fetching sample events")
        try {
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
            events = result.events
            spinner.stop(`Fetched ${events.length} sample event${events.length === 1 ? "" : "s"}`)
        } catch (err) {
            spinner.stop(err instanceof Error ? err.message : "Failed to fetch sample events.")
        }
    }

    // Add a synthetic manual trigger event for each time trigger
    for (const trigger of timeTriggers) {
        events.push(
            serializeEvent({
                integrationType: IntegrationType.CRON_JOB,
                eventType: "cron",
                inputId: trigger.integrationId,
                isManualTrigger: true,
                manualContext: `Manual trigger from terse test (schedule: ${(trigger as any).cronExpression ?? "unknown"})`
            })
        )
    }

    // Add a synthetic manual trigger event for each webhook trigger
    for (const trigger of webhookTriggers) {
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

    if (events.length === 0) {
        log.error("No sample events available. Make sure your triggers are configured and events have been received.")
        process.exit(1)
    }

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
