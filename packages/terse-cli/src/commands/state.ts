import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import { ApiRoutes } from "terse-types"
import type { SdkStateListResponse, SdkStateReadResponse, SdkStateResetResponse } from "terse-types"

import { ApiError, fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { CliError } from "../cliError.js"
import { loadJob } from "../loadJob.js"
import { readProjectConfigOrBail } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

import { humanSize } from "./memory.js"

export async function stateList(opts: BaseOpts & { json?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    const jobName = await resolveJobName(opts)

    const response = await fetchWithAuth<SdkStateListResponse>(ApiRoutes.SDK.STATE_LIST, apiKey, { projectId: config.projectId, jobName, test: opts.test }, "POST")

    if (opts.json) {
        process.stdout.write(JSON.stringify(response, null, 2) + "\n")
        return
    }

    const lane = laneLabel(opts.test)
    if (response.keys.length === 0) {
        process.stdout.write(`No ${lane} state for job ${chalk.cyan(jobName)} yet.\n`)
        return
    }

    process.stdout.write(`${capitalize(lane)} state for job ${chalk.cyan(jobName)}:\n\n`)
    for (const entry of response.keys) {
        process.stdout.write(`  ${humanSize(entry.sizeBytes).padStart(7, " ")}  ${entry.key}\n`)
    }
    process.stdout.write(chalk.dim(`\nRead one with:  terse state get <key> --job ${jobName}${opts.test ? " --test" : ""}\n`))
}

export async function stateGet(key: string, opts: BaseOpts = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    const jobName = await resolveJobName(opts)

    let response: SdkStateReadResponse
    try {
        response = await fetchWithAuth<SdkStateReadResponse>(ApiRoutes.SDK.STATE_READ, apiKey, { projectId: config.projectId, jobName, key, test: opts.test }, "POST")
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            throw new CliError("state_key_not_found", `No ${laneLabel(opts.test)} state value for key "${key}" on job ${jobName}.`)
        }
        throw error
    }

    process.stdout.write(response.content)
    if (!response.content.endsWith("\n")) process.stdout.write("\n")
}

export async function stateRemove(key: string, opts: BaseOpts & { yes?: boolean } = {}): Promise<void> {
    assertTestLane(opts)
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    const jobName = await resolveJobName(opts)

    await confirmOrBail(opts.yes, `Delete state key "${key}" from ${jobName} test state?`)

    try {
        await fetchWithAuth(ApiRoutes.SDK.STATE_DELETE, apiKey, { projectId: config.projectId, jobName, key, test: true }, "POST")
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            throw new CliError("state_key_not_found", `No test state value for key "${key}" on job ${jobName}.`)
        }
        throw error
    }
    process.stdout.write(chalk.green(`Deleted state key "${key}" from ${jobName} test state.\n`))
}

export async function stateReset(opts: BaseOpts & { yes?: boolean } = {}): Promise<void> {
    assertTestLane(opts)
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    const jobName = await resolveJobName(opts)

    await confirmOrBail(opts.yes, `Reset all test state for ${jobName}?`)

    const response = await fetchWithAuth<SdkStateResetResponse>(ApiRoutes.SDK.STATE_RESET, apiKey, { projectId: config.projectId, jobName, test: true }, "POST")
    const keys = response.deleted === 1 ? "1 key" : `${response.deleted} keys`
    process.stdout.write(chalk.green(`Reset test state for job ${jobName} (${keys} deleted).\n`))
}

async function resolveJobName(opts: BaseOpts): Promise<string> {
    if (opts.job?.trim()) return opts.job.trim()
    const provider = opts.provider ?? resolveProvider()
    const { job } = await loadJob(provider, undefined, opts.entryFile, { nonInteractive: true })
    return job.name
}

function assertTestLane(opts: BaseOpts): void {
    if (opts.test) return
    throw new CliError("deployed_state_read_only", "Deployed state is read-only from the CLI.", {
        detail: "Pass --test to target the test state used by `terse test` runs."
    })
}

async function confirmOrBail(yes: boolean | undefined, message: string): Promise<void> {
    if (yes) return
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new CliError("confirmation_required", "Refusing to modify state without confirmation.", {
            detail: "Pass --yes to confirm non-interactively."
        })
    }
    const approved = await confirm({ message, default: false })
    if (!approved) {
        process.stdout.write("Cancelled.\n")
        process.exit(0)
    }
}

function laneLabel(test?: boolean): string {
    return test ? "test" : "deployed"
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

type BaseOpts = { job?: string; test?: boolean; entryFile?: string; provider?: LanguageProvider }
