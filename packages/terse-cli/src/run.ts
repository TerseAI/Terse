import chalk from "chalk"
import { CreateJobParameters, TerseAgent } from "terse-sdk"
import { readApiKey } from "./api.js"
import { loadJob } from "./loadJob.js"
import type { SerializedEvent } from "./shared/types.js"
import { convertSerializedEventToInputEvent } from "./util.js"


/**
 * Create a TerseAgent scoped to a job's skills and execute onTrigger.
 * Tools are registered from the codegen factory on globalThis (needed because
 * tsx may load a separate module instance of terse-sdk).
 */
export async function executeJob(job: CreateJobParameters, event: SerializedEvent): Promise<void> {
    const inputEvent = convertSerializedEventToInputEvent(event)

    const agent = new TerseAgent(job.skills)
    const createTools = (globalThis as any).__terse_createTools as ((agent: TerseAgent) => unknown) | undefined
    if (createTools) {
        Object.defineProperty(agent, "tools", { value: createTools(agent) })
    }

    try {
        await job.onTrigger(inputEvent, agent)
        console.log(chalk.green(`\n  Job "${job.name}" completed successfully.\n`))
    } catch (err) {
        console.error(chalk.red(`\n  Job "${job.name}" threw an error:\n`))
        console.error(err)
        process.exit(1)
    }
}

export async function run(jobName?: string, eventJson?: string): Promise<void> {
    if (!eventJson) {
        console.error(chalk.red("Error: --event <json> is required.\n"))
        console.error(chalk.dim("  Usage: terse run --event '{\"integrationType\":\"...\",\"formattedContent\":\"...\",\"debugLog\":\"...\"}'"))
        console.error(chalk.dim("  Tip:   Use `terse test` to interactively pick a sample event.\n"))
        process.exit(1)
    }

    readApiKey() // populates process.env.TERSE_API_KEY for SDK executeTool()
    const { job } = await loadJob(jobName)
    console.log(chalk.cyan(`\n  Running job: ${job.name}\n`))

    let parsed: SerializedEvent
    try {
        parsed = JSON.parse(eventJson) as SerializedEvent
    } catch {
        console.error(chalk.red("Error: --event value is not valid JSON."))
        process.exit(1)
    }

    await executeJob(job, parsed)
}
