import chalk from "chalk"
import { zipSync } from "fflate"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"
import { ApiRoutes, sdkDeployRequestBodySchema } from "terse-types"
import type { SdkDeployResponseBody } from "terse-types"

import { fetchWithAuth, readApiKeyOrBail, readEnvVar } from "./api.js"
import { loadJobRegistry } from "./loadJob.js"
import type { LanguageProvider } from "./providers/LanguageProvider.js"
import { resolveProvider } from "./providers/resolveProvider.js"

export async function deploy(provider: LanguageProvider = resolveProvider(), entryFile?: string) {
    const apiKey = readApiKeyOrBail({
        title: "Error: No TERSE_API_KEY found in .env",
        detail: "Run `terse init` to set up your project, or add TERSE_API_KEY to your .env file."
    })

    const registry = await loadJobRegistry(provider, entryFile)
    const jobs = [...registry.values()]

    // If TERSE_JOB_URL is set in .env, deploy in URL mode (user infrastructure).
    // All jobs get this URL and no source code is zipped or uploaded.
    const jobUrl = readEnvVar("TERSE_JOB_URL")
    const isUrlMode = !!jobUrl

    let sourceZipBase64: string | undefined
    let fileCount = 0
    let zipSizeBytes = 0

    if (!isUrlMode) {
        const zipPayload = buildZipPayload(provider)
        sourceZipBase64 = zipPayload.sourceZipBase64
        fileCount = zipPayload.fileCount
        zipSizeBytes = zipPayload.zipSizeBytes
    }

    const spinner = ora(`Deploying ${jobs.length} job${jobs.length === 1 ? "" : "s"}...`).start()

    try {
        const body = sdkDeployRequestBodySchema.parse({
            jobs: jobs.map(job => ({
                jobName: job.name,
                triggers: job.triggers,
                outputs: job.skills ?? [],
                toolApprovals: job.toolApprovals ?? []
            })),
            jobUrl: isUrlMode ? jobUrl : undefined,
            sourceZipBase64
        })

        const result = await fetchWithAuth<SdkDeployResponseBody>(ApiRoutes.SDK.DEPLOY, apiKey, body, "POST")

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
            if (r.triggers) {
                for (const t of r.triggers) {
                    if (t.metadata?.webhookUrl) {
                        console.log(chalk.cyan(`    Webhook URL: ${t.metadata.webhookUrl}`))
                    }
                }
            }
        }

        if (isUrlMode) {
            console.log(chalk.dim(`  Mode: user infrastructure`))
            console.log(chalk.dim(`  Job URL: ${jobUrl}`))
        } else {
            console.log(chalk.dim(`  Files: ${fileCount}`))
            console.log(chalk.dim(`  Zip size: ${(zipSizeBytes / 1024).toFixed(1)} KB`))
        }

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

function collectFiles(dir: string, baseDir: string, provider: LanguageProvider): Record<string, Uint8Array> {
    const entries: Record<string, Uint8Array> = {}

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (provider.deployExclusions.dirs.has(entry.name)) continue
        if (provider.deployExclusions.files.has(entry.name)) continue

        const fullPath = path.join(dir, entry.name)
        const relativePath = path.relative(baseDir, fullPath)

        if (entry.isDirectory()) {
            Object.assign(entries, collectFiles(fullPath, baseDir, provider))
        } else if (entry.isFile()) {
            entries[relativePath] = new Uint8Array(fs.readFileSync(fullPath))
        }
    }

    return entries
}

function buildZipPayload(provider: LanguageProvider): { sourceZipBase64: string; fileCount: number; zipSizeBytes: number } {
    const cwd = process.cwd()
    const files = collectFiles(cwd, cwd, provider)
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
