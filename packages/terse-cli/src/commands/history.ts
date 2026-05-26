import chalk from "chalk"
import ora from "ora"
import { RunHistoryStatus } from "terse-types"
import type { GetRunHistoryParams, RunHistoryStatus as RunHistoryStatusType } from "terse-types"

import { fetchRunChatHistory, fetchRunHistory, readApiKeyOrBail, resolveAgentIdByJobName, resolveEventFromRunId } from "../api.js"
import { CliError } from "../cliError.js"
import { loadJob } from "../loadJob.js"
import { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

import { type RunWithEvents, printRunChat, printRuns } from "./historyPrinters.js"

const VALID_STATUSES = new Set<RunHistoryStatusType>(Object.values(RunHistoryStatus) as RunHistoryStatusType[])
const MAX_PAGE_SIZE = 100

export async function history(jobName?: string, options: HistoryOptions = {}, provider: LanguageProvider = resolveProvider()): Promise<void> {
    const apiKey = readApiKeyOrBail()

    // Single-run mode bypasses job/agent resolution.
    if (options.runId) {
        const chat = await fetchRunChatHistory(options.runId, apiKey)
        if (options.json) {
            process.stdout.write(JSON.stringify({ runId: options.runId, ...chat }, null, 2) + "\n")
            return
        }
        printRunChat(options.runId, chat)
        return
    }

    const { job } = await loadJob(provider, jobName)

    const spinner = options.json ? null : ora(`Fetching run history for ${job.name}`).start()
    let agentId: string | null
    try {
        agentId = await resolveAgentIdByJobName(job.name, apiKey)
    } catch (error) {
        spinner?.fail(chalk.red("Failed to look up job"))
        throw error
    }

    if (!agentId) {
        spinner?.fail(chalk.red(`Job "${job.name}" is not deployed`))
        throw new CliError("no_deployed_agent", `Job "${job.name}" is not deployed`, {
            detail: "Have you run `terse deploy` for this job?"
        })
    }

    const params = buildParams(options)

    const response = await fetchRunHistory(agentId, apiKey, params)
    let items: RunWithEvents[] = response.items

    // --triggers: cheap per-run fetch of just the input event JSON via /sdk/runs/:runId/trigger-event.
    // Implied by --events (which fetches the full chat history including the trigger payload).
    if (options.triggers && !options.events && items.length > 0) {
        if (spinner) spinner.text = `Fetching trigger events for ${items.length} run${items.length === 1 ? "" : "s"}`
        items = await Promise.all(
            items.map(async run => {
                const triggerEvent = await resolveEventFromRunId(run.id, apiKey)
                return triggerEvent ? { ...run, triggerEvent: triggerEvent.event } : run
            })
        )
    }

    // --events: full chat history per run (model events + trigger event). Heavier than --triggers.
    if (options.events && items.length > 0) {
        if (spinner) spinner.text = `Fetching chat events for ${items.length} run${items.length === 1 ? "" : "s"}`
        items = await Promise.all(
            items.map(async run => {
                try {
                    const chat = await fetchRunChatHistory(run.id, apiKey)
                    return { ...run, chat }
                } catch {
                    return run
                }
            })
        )
    }

    spinner?.succeed(`Fetched ${items.length} of ${response.total} run${response.total === 1 ? "" : "s"} for ${job.name}`)

    if (options.json) {
        const payload = {
            jobName: job.name,
            agentId,
            page: response.page,
            pageSize: response.pageSize,
            total: response.total,
            items
        }
        process.stdout.write(JSON.stringify(payload, null, 2) + "\n")
        return
    }

    printRuns(job.name, agentId, items, response.total)
}

function buildParams(options: HistoryOptions): GetRunHistoryParams {
    const params: GetRunHistoryParams = {}

    if (options.query) params.q = options.query
    if (options.since) params.start = options.since
    if (options.until) params.end = options.until
    if (options.page && options.page > 0) params.page = options.page

    if (options.limit && options.limit > 0) {
        params.pageSize = Math.min(options.limit, MAX_PAGE_SIZE)
    }

    if (options.status) {
        const statuses = options.status
            .split(",")
            .map(s => s.trim())
            .filter((s): s is RunHistoryStatusType => VALID_STATUSES.has(s as RunHistoryStatusType))
        if (statuses.length > 0) params.status = statuses
    }

    return params
}

// Types

export type HistoryOptions = {
    json?: boolean
    limit?: number
    page?: number
    status?: string
    since?: string
    until?: string
    query?: string
    triggers?: boolean
    events?: boolean
    runId?: string
}
