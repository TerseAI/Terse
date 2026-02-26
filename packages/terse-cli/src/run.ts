import chalk from "chalk"
import { ActionResult, CreateJobParameters, EventType, FinalOutputResult, TerseAgent, TerseAgentResult, ToolCallCompletedResult, ToolCallStartedResult } from "terse-sdk"
import { readApiKey } from "./api.js"
import { loadJob } from "./loadJob.js"
import type { SerializedEvent } from "./shared/types.js"
import { convertSerializedEventToInputEvent } from "./util.js"


/**
 * Create a TerseAgent scoped to a job's skills and execute onTrigger.
 * Tools are registered from the codegen factory on globalThis (needed because
 * tsx may load a separate module instance of terse-sdk).
 */
export async function executeJob(job: CreateJobParameters, event: SerializedEvent, options?: { verbose?: boolean }): Promise<void> {
    const inputEvent = convertSerializedEventToInputEvent(event)
    const isVerbose = options?.verbose ?? false

    const agent = new TerseAgent(job.skills)
    const createTools = (globalThis as any).__terse_createTools as ((agent: TerseAgent) => unknown) | undefined
    if (createTools) {
        Object.defineProperty(agent, "tools", { value: createTools(agent) })
    }
    if (isVerbose) {
        instrumentAgentRunForCliLogs(agent)
    }

    try {
        if (isVerbose) {
            console.log(chalk.cyan(`  Job "${job.name}" started`))
        }
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

function instrumentAgentRunForCliLogs(agent: TerseAgent): void {
    const originalRun = agent.run.bind(agent)
    agent.run = (async function* (prompt: string, event?: any): AsyncGenerator<TerseAgentResult> {
        console.log(chalk.gray(`\n  [agent.run] prompt: ${truncate(prompt, 120)}\n`))
        for await (const chunk of originalRun(prompt, event)) {
            logStreamChunk(chunk)
            yield chunk
        }
    }) as TerseAgent["run"]
}

function logStreamChunk(chunk: TerseAgentResult): void {
    if (chunk.type === EventType.TOOL_CALL_STARTED) {
        const data = chunk as ToolCallStartedResult
        console.log(chalk.blue(`  [tool:start] ${data.toolCallStarted}`))
        return
    }
    if (chunk.type === EventType.TOOL_CALL_COMPLETED) {
        const data = chunk as ToolCallCompletedResult
        const parsed = safeParseJson(data.toolCallCompleted)
        const toolName = parsed?.tool || "unknown_tool"
        const status = parsed?.status || "unknown"
        const symbol = status === "completed" ? chalk.green("ok") : chalk.red("failed")
        console.log(`  [tool:done] ${toolName} (${symbol})`)
        return
    }
    if (chunk.type === EventType.ACTION) {
        const data = chunk as ActionResult
        const actionName = data.action?.action || "action"
        const target = data.action?.target ? ` -> ${data.action.target}` : ""
        console.log(chalk.magenta(`  [action] ${actionName}${target}`))
        return
    }
    if (chunk.type === EventType.FINAL_OUTPUT) {
        const data = chunk as FinalOutputResult
        console.log(chalk.green(`\n  [final_output] ${data.finalOutput}\n`))
    }
}

function safeParseJson(value: string): Record<string, any> | null {
    try {
        return JSON.parse(value) as Record<string, any>
    } catch {
        return null
    }
}

function truncate(text: string, maxLength: number): string {
    const normalized = text.trim()
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, maxLength - 3)}...`
}
