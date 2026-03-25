import fs from "node:fs"
import path from "node:path"
import chalk from "chalk"
import ora from "ora"
import { zipSync } from "fflate"

import { fetchWithAuth, readApiKey } from "./api.js"
import { assertProjectRoot } from "./assertProjectRoot.js"
import { loadJobRegistry } from "./loadJob.js"
import { ApiRoutes } from "./shared/ApiRoutes.js"
import type { SdkDeployResponseBody } from "./shared/types.js"

const EXCLUDED_DIRS = new Set(["node_modules", ".git", "dist", ".next", ".turbo"])
const EXCLUDED_FILES = new Set([".env", ".DS_Store"])

export async function deploy() {
    assertProjectRoot()

    const apiKey = readApiKey()
    if (!apiKey) {
        console.error(chalk.red("Error: No TERSE_API_KEY found in .env"))
        console.error(chalk.dim("Run `terse init` to set up your project, or add TERSE_API_KEY to your .env file."))
        process.exit(1)
    }

    const registry = await loadJobRegistry()
    const jobs = [...registry.values()]
    const { sourceZipBase64, fileCount, zipSizeBytes } = buildZipPayload()

    const spinner = ora(`Deploying ${jobs.length} job${jobs.length === 1 ? "" : "s"}...`).start()

    try {
        const result = await fetchWithAuth<SdkDeployResponseBody>(
            ApiRoutes.SDK.DEPLOY,
            apiKey,
            {
                jobs: jobs.map(job => ({
                    jobName: job.name,
                    triggers: job.triggers.map(serializeTrigger),
                    toolApprovals: job.toolApprovals,
                    webhookURL: job.webhookURL
                })),
                sourceZipBase64
            },
            "POST"
        )

        if (!result.success) {
            spinner.fail(chalk.red(`Deploy failed: ${result.error}`))
            if (result.details) {
                console.error(chalk.dim(`  ${result.details}`))
            }
            process.exit(1)
        }

        spinner.succeed(chalk.green(`Deployed ${result.results.length} job${result.results.length === 1 ? "" : "s"}`))

        for (const r of result.results) {
            const verb = r.isUpdate ? "Updated" : "Created"
            console.log(chalk.dim(`  ${verb} "${r.jobName}" (${r.automationId})`))
        }

        console.log(chalk.dim(`  Files: ${fileCount}`))
        console.log(chalk.dim(`  Zip size: ${(zipSizeBytes / 1024).toFixed(1)} KB`))

        if (result.removed.length > 0) {
            console.log(chalk.yellow(`\nRemoved ${result.removed.length} stale job${result.removed.length === 1 ? "" : "s"} no longer in project:`))
            for (const r of result.removed) {
                console.log(chalk.dim(`  - ${r.name} (${r.id})`))
            }
        }
    } catch (error) {
        spinner.fail(chalk.red(`Deploy failed: ${(error as Error).message}`))
        process.exit(1)
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
    const { isComplete, formatForAgent, configType, integrationType, integrationId, ...rest } = config
    return {
        configType,
        integrationType,
        integrationId,
        config: rest
    }
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
