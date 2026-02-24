import chalk from "chalk"
import { TerseAgent } from "terse-sdk"
import { readApiKey } from "./api.js"
import { loadJob } from "./loadJob.js"
import type { SerializedEvent } from "./shared/types.js"
import { convertSerializedEventToInputEvent } from "./util.js"


export async function run(jobName?: string, eventJson?: string): Promise<void> {
    if (!eventJson) {
        console.error(chalk.red("Error: --event <json> is required.\n"))
        console.error(chalk.dim("  Usage: terse run --event '{\"integrationType\":\"...\",\"formattedContent\":\"...\",\"debugLog\":\"...\"}'"))
        console.error(chalk.dim("  Tip:   Use `terse test` to interactively pick a sample event.\n"))
        process.exit(1)
    }

    readApiKey() // populates process.env.TERSE_API_KEY for SDK executeTool()
    const { name: resolvedName, job } = await loadJob(jobName)
    console.log(chalk.cyan(`\n  Running job: ${resolvedName}\n`))

    let parsed: SerializedEvent
    try {
        parsed = JSON.parse(eventJson) as SerializedEvent
    } catch {
        console.error(chalk.red("Error: --event value is not valid JSON."))
        process.exit(1)
    }
    const event = convertSerializedEventToInputEvent(parsed)

    const stubAgent = new TerseAgent("", [])

    try {
        await job.onTrigger(event, stubAgent)
        console.log(chalk.green(`\n  Job "${resolvedName}" completed successfully.\n`))
    } catch (err) {
        console.error(chalk.red(`\n  Job "${resolvedName}" threw an error:\n`))
        console.error(err)
        process.exit(1)
    }
}
