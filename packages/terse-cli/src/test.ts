import chalk from "chalk"
import ora from "ora"
import { select } from "@inquirer/prompts"
import { ConfigInstance, IntegrationType } from "terse-sdk"
import { fetchWithAuth, readApiKey } from "./api.js"
import { ApiRoutes } from "./shared/ApiRoutes.js"
import type { SerializedEvent } from "./shared/types.js"
import { loadJob } from "./loadJob.js"
import { executeJob } from "./run.js"


export async function test(jobName?: string): Promise<void> {
    const { job } = await loadJob(jobName)
    console.log(chalk.cyan(`\n  Testing job: ${job.name}\n`))

    const apiKey = readApiKey()
    if (!apiKey) {
        console.error(chalk.red("Error: No API key found. Unable to fetch sample events. Add a TERSE_API_KEY to your .env file."))
        process.exit(1)
    }

    // Split triggers into time-based and integration-based
    const timeTriggers = job.triggers.filter((t: ConfigInstance) => t.integrationType === IntegrationType.CRON_JOB)
    const integrationTriggers = job.triggers.filter((t: ConfigInstance) => t.integrationType !== IntegrationType.CRON_JOB)

    let events: SerializedEvent[] = []

    // Fetch sample events for integration triggers (time triggers have no sample events)
    if (integrationTriggers.length > 0) {
        const spinner = ora("Fetching sample events").start()
        try {
            const result = await fetchWithAuth<{ events: SerializedEvent[] }>(ApiRoutes.SDK.SAMPLE_EVENTS, apiKey, {
                triggers: integrationTriggers.map((trigger: ConfigInstance) => ({
                    integrationId: trigger.integrationId,
                    integrationType: trigger.integrationType,
                    config: trigger
                }))
            }, "POST")
            events = result.events
            spinner.succeed(`Sample events fetched. Found ${events.length} events.`)
        } catch {
            spinner.fail("Failed to fetch sample events.")
        }
    }

    // Add a synthetic manual trigger event for each time trigger
    for (const trigger of timeTriggers) {
        events.push({
            integrationType: IntegrationType.CRON_JOB,
            formattedContent: `This is a manually triggered event for a time trigger (schedule: ${(trigger as any).cronExpression ?? "unknown"}).`,
            debugLog: "Manual Trigger"
        })
    }

    if (events.length === 0) {
        console.error(chalk.red("\n  No sample events available. Make sure your triggers are configured and events have been received.\n"))
        process.exit(1)
    }

    const choice = await select<number>({
        message: "Select sample event:",
        choices: events.map((event, index) => ({
            name: `${event.integrationType} - ${event.debugLog}`,
            value: index,
        })),
    })

    await executeJob(job, events[choice])
}
