import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import fs from "node:fs"
import { ApiRoutes } from "terse-types"
import type { SdkMemoryGetResponse, SdkMemoryListResponse } from "terse-types"

import { ApiError, fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { CliError } from "../cliError.js"
import { loadJob } from "../loadJob.js"
import { readProjectConfigOrBail } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

type BaseOpts = { job?: string; test?: boolean; entryFile?: string; provider?: LanguageProvider }

async function resolveJobName(opts: BaseOpts): Promise<string> {
    if (opts.job?.trim()) return opts.job.trim()
    const provider = opts.provider ?? resolveProvider()
    const { job } = await loadJob(provider, undefined, opts.entryFile, { nonInteractive: true })
    return job.name
}

export function humanSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    const units = ["K", "M", "G", "T"]
    let value = bytes / 1024
    let unitIdx = 0
    while (value >= 1024 && unitIdx < units.length - 1) {
        value /= 1024
        unitIdx++
    }
    return `${value.toFixed(1)}${units[unitIdx]}`
}

export async function memoryList(opts: BaseOpts & { json?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    const jobName = await resolveJobName(opts)

    const response = await fetchWithAuth<SdkMemoryListResponse>(ApiRoutes.SDK.MEMORY_LIST, apiKey, { projectId: config.projectId, jobName, test: opts.test }, "POST")

    if (opts.json) {
        process.stdout.write(JSON.stringify(response, null, 2) + "\n")
        return
    }

    if (response.files.length === 0) {
        process.stdout.write(`No memory for job ${chalk.cyan(jobName)} yet.\n`)
        return
    }

    process.stdout.write(`Memory for job ${chalk.cyan(jobName)}:\n\n`)
    for (const file of response.files) {
        const name = file.isDirectory ? chalk.blue(`${file.path}/`) : file.path
        process.stdout.write(`  ${humanSize(file.sizeBytes).padStart(7, " ")}  ${name}\n`)
    }
    process.stdout.write(chalk.dim(`\nRead one with:  terse memory get <path> --job ${jobName}\n`))
}

export async function memoryGet(filePath: string, opts: BaseOpts & { out?: string } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    const jobName = await resolveJobName(opts)

    let response: SdkMemoryGetResponse
    try {
        response = await fetchWithAuth<SdkMemoryGetResponse>(ApiRoutes.SDK.MEMORY_GET, apiKey, { projectId: config.projectId, jobName, path: filePath, test: opts.test }, "POST")
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            throw new CliError("memory_file_not_found", `${filePath} not found in memory for job ${jobName}.`)
        }
        throw error
    }

    if (opts.out) {
        fs.writeFileSync(opts.out, response.content)
        process.stdout.write(chalk.green(`Saved ${filePath} to ${opts.out}\n`))
        return
    }
    process.stdout.write(response.content)
    if (!response.content.endsWith("\n")) process.stdout.write("\n")
}

export async function memoryPut(filePath: string, opts: BaseOpts & { file?: string } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    const jobName = await resolveJobName(opts)

    const content = opts.file ? readLocalFile(opts.file) : await readStdin()

    await fetchWithAuth(ApiRoutes.SDK.MEMORY_PUT, apiKey, { projectId: config.projectId, jobName, path: filePath, content, test: opts.test }, "POST")
    process.stdout.write(chalk.green(`Wrote ${filePath} to ${jobName} memory.\n`))
}

export async function memoryRemove(filePath: string, opts: BaseOpts & { yes?: boolean } = {}): Promise<void> {
    const apiKey = readApiKeyOrBail()
    const config = readProjectConfigOrBail()
    const jobName = await resolveJobName(opts)

    if (!opts.yes) {
        if (!process.stdin.isTTY || !process.stdout.isTTY) {
            throw new CliError("confirmation_required", "Refusing to delete a memory file without confirmation.", {
                detail: "Pass --yes to confirm non-interactively."
            })
        }
        const approved = await confirm({ message: `Delete ${filePath} from ${jobName} memory?`, default: false })
        if (!approved) {
            process.stdout.write("Cancelled.\n")
            return
        }
    }

    try {
        await fetchWithAuth(ApiRoutes.SDK.MEMORY_DELETE, apiKey, { projectId: config.projectId, jobName, path: filePath, test: opts.test }, "POST")
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            throw new CliError("memory_file_not_found", `${filePath} not found in memory for job ${jobName}.`)
        }
        throw error
    }
    process.stdout.write(chalk.green(`Deleted ${filePath} from ${jobName} memory.\n`))
}

function readLocalFile(filePath: string): string {
    try {
        return fs.readFileSync(filePath, "utf8")
    } catch (error) {
        throw new CliError("memory_file_unreadable", `Could not read ${filePath}.`, {
            detail: error instanceof Error ? error.message : String(error)
        })
    }
}

async function readStdin(): Promise<string> {
    if (process.stdin.isTTY) {
        throw new CliError("memory_content_required", "No content provided.", {
            detail: "Pass --file <path> or pipe the new contents on stdin."
        })
    }
    const chunks: Buffer[] = []
    for await (const chunk of process.stdin) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk)
    }
    return Buffer.concat(chunks).toString("utf8")
}
