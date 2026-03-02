import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"
import ora from "ora"
import { zipSync } from "fflate"
import { CreateJobParameters } from "terse-sdk"

import { fetchWithAuth, readApiKey } from "./api.js"
import { assertProjectRoot } from "./assertProjectRoot.js"
import { loadJob, loadJobRegistry } from "./loadJob.js"
import { ApiRoutes } from "./shared/ApiRoutes.js"

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".turbo"])
const EXCLUDED_FILES = new Set([".env", ".DS_Store"])

async function deploySingleJob(
    job: CreateJobParameters,
    apiKey: string,
    sourceZipBase64: string,
    fileCount: number,
    zipSizeBytes: number
): Promise<boolean> {
    const spinner = ora(`Deploying "${job.name}"...`).start()

    try {
        const triggers = job.triggers.map(serializeTrigger)

        spinner.text = `Uploading "${job.name}"...`
        const result = await fetchWithAuth<DeployResponse>(
            ApiRoutes.SDK.DEPLOY,
            apiKey,
            {
                jobName: job.name,
                triggers,
                webhookURL: job.webhookURL,
                sourceZipBase64
            },
            "POST"
        )

        if (result.success) {
            spinner.succeed(
                result.isUpdate
                    ? chalk.green(`Updated "${job.name}" (${result.automationId})`)
                    : chalk.green(`Deployed "${job.name}" (${result.automationId})`)
            )
            console.log(chalk.dim(`  Triggers: ${triggers.length}`))
            console.log(chalk.dim(`  Files: ${fileCount}`))
            console.log(chalk.dim(`  Zip size: ${(zipSizeBytes / 1024).toFixed(1)} KB`))
            return true
        } else {
            spinner.fail(chalk.red(`Deploy failed for "${job.name}": ${result.error}`))
            if (result.details) {
                console.error(chalk.dim(`  ${result.details}`))
            }
            return false
        }
    } catch (error) {
        spinner.fail(chalk.red(`Deploy failed for "${job.name}": ${(error as Error).message}`))
        return false
    }
}

export async function deploy(jobName?: string, all?: boolean) {
    assertProjectRoot()

    const apiKey = readApiKey()
    if (!apiKey) {
        console.error(chalk.red("Error: No TERSE_API_KEY found in .env"))
        console.error(chalk.dim("Run `terse init` to set up your project, or add TERSE_API_KEY to your .env file."))
        process.exit(1)
    }

    // Zip once — all jobs in the same package share the same source
    const { sourceZipBase64, fileCount, zipSizeBytes } = buildZipPayload()

    if (all) {
        // Deploy every job in the registry
        const registry = await loadJobRegistry()
        const jobs = [...registry.values()]

        console.log(chalk.bold(`Deploying ${jobs.length} job${jobs.length === 1 ? "" : "s"}...\n`))

        let failed = 0
        for (const job of jobs) {
            const ok = await deploySingleJob(job, apiKey, sourceZipBase64, fileCount, zipSizeBytes)
            if (!ok) failed++
            console.log() // blank line between jobs
        }

        if (failed > 0) {
            console.error(chalk.red(`\n${failed} of ${jobs.length} deploy(s) failed.`))
            process.exit(1)
        }

        console.log(chalk.green(`\nAll ${jobs.length} job${jobs.length === 1 ? "" : "s"} deployed successfully.`))
    } else {
        // Deploy a single job (prompt if multiple exist and no name given)
        const { job } = await loadJob(jobName)
        const ok = await deploySingleJob(job, apiKey, sourceZipBase64, fileCount, zipSizeBytes)
        if (!ok) process.exit(1)
    }
}

function collectFiles(dir: string, baseDir: string): Record<string, Uint8Array> {
    const entries: Record<string, Uint8Array> = {}

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (EXCLUDED_DIRS.has(entry.name)) continue
        if (EXCLUDED_FILES.has(entry.name)) continue

        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(baseDir, fullPath)

        if (entry.isDirectory()) {
            Object.assign(entries, collectFiles(fullPath, baseDir))
        } else if (entry.isFile()) {
            entries[relativePath] = new Uint8Array(fs.readFileSync(fullPath))
        }
    }

    return entries
}

function serializeTrigger(config: any): {
    configType: string
    integrationType: string
    integrationId: string
    config: Record<string, unknown>
} {
    // Extract data properties from the ConfigInstance class, excluding methods
    const { isComplete, formatForAgent, configType, integrationType, integrationId, ...rest } = config
    return {
        configType,
        integrationType,
        integrationId,
        config: rest
    }
}

interface DeployResponse {
    success: boolean
    automationId: string
    isUpdate: boolean
    error?: string
    details?: string
}

function buildZipPayload(): { sourceZipBase64: string; fileCount: number; zipSizeBytes: number } {
    const cwd = process.cwd()
    const files = collectFiles(cwd, cwd)
    const fileCount = Object.keys(files).length

    if (fileCount === 0) {
        console.error(chalk.red("No files found to deploy"))
        process.exit(1)
    }

    const zipData = zipSync(files, { level: 6 })
    return {
        sourceZipBase64: Buffer.from(zipData).toString("base64"),
        fileCount,
        zipSizeBytes: zipData.length
    }
}