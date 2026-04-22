import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import { zipSync } from "fflate"
import fs from "node:fs"
import path from "node:path"
import ora from "ora"
import { ApiRoutes, sdkDeployRequestBodySchema } from "terse-types"
import type { SdkDeployResponseBody, TerseProjectConfig } from "terse-types"

import { ApiError, fetchWithAuth, readApiKeyOrBail } from "../api.js"
import { loadJobRegistry } from "../loadJob.js"
import { PROJECT_CONFIG_FILENAME, createRemoteProject, readProjectConfigOrBail, writeProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"

export async function deploy(provider: LanguageProvider = resolveProvider(), entryFile?: string, hasRetried = false) {
    const apiKey = readApiKeyOrBail({
        title: "Error: Not authenticated.",
        detail: "Run `terse login` to authenticate, or set TERSE_API_KEY in your environment."
    })

    const config = readProjectConfigOrBail()
    const { projectId } = config

    const registry = await loadJobRegistry(provider, entryFile)
    const jobs = [...registry.values()]

    // Self-hosted mode is driven entirely by terse.config.json (selfHosted + remoteServerUrl).
    const remoteServerUrl = config.remoteServerUrl?.trim() || undefined

    if (config.selfHosted && !remoteServerUrl) {
        console.error(chalk.red(`\n  Error: Self-hosted mode is enabled but no server URL is configured.`))
        console.error(chalk.dim(`  Set ${chalk.cyan("remoteServerUrl")} in ${chalk.cyan(PROJECT_CONFIG_FILENAME)} to the URL where your Terse SDK is running.\n`))
        console.error(`  Example:`)
        console.error(chalk.dim(`    {`))
        console.error(chalk.dim(`      "projectId": "${projectId}",`))
        console.error(chalk.dim(`      "name": "${config.name}",`))
        console.error(chalk.dim(`      "selfHosted": true,`))
        console.error(chalk.dim(`      "remoteServerUrl": "https://your-app.example.com"`))
        console.error(chalk.dim(`    }\n`))
        process.exit(1)
    }

    const isUrlMode = !!remoteServerUrl

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
            projectId,
            jobs: jobs.map(job => ({
                jobName: job.name,
                triggers: job.triggers
            })),
            remoteServerUrl: isUrlMode ? remoteServerUrl : undefined,
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
            console.log(chalk.dim(`  Server URL: ${remoteServerUrl}`))

            const signingSecret = result.signingSecret
            const projectApiKey = result.projectApiKey
            if (signingSecret || projectApiKey) {
                const labels: string[] = []
                if (signingSecret) labels.push("signing secret")
                if (projectApiKey) labels.push("project API key")
                console.log(chalk.yellow(`\n  ${chalk.bold(`New ${labels.join(" and ")} generated.`)} Save now, will not be shown again.`))
                console.log(chalk.dim(`  If lost, rotate from the Terse dashboard to issue a new one.\n`))
                console.log(`  Add to your ${chalk.bold(".env")} file:\n`)
                if (projectApiKey) console.log(`TERSE_API_KEY=${projectApiKey}`)
                if (signingSecret) console.log(`TERSE_SIGNING_SECRET=${signingSecret}`)
                console.log("")
            }
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
        spinner.stop()
        if (await tryRecoverStaleProject(error, { apiKey, config, hasRetried })) {
            return deploy(provider, entryFile, true)
        }

        spinner.fail(chalk.red(`Deploy failed: ${(error as Error).message}`))
        if (isProjectGoneError(error)) {
            console.error(chalk.dim(`  Run ${chalk.cyan("terse attach")} to link this directory to an existing project.`))
        }
        process.exit(1)
    }
}

function isProjectGoneError(error: unknown): error is ApiError {
    return error instanceof ApiError && error.status === 404 && error.body.errorCode === "PROJECT_NOT_FOUND"
}

async function tryRecoverStaleProject(error: unknown, args: { apiKey: string; config: TerseProjectConfig; hasRetried: boolean }): Promise<boolean> {
    if (!isProjectGoneError(error)) return false
    if (args.hasRetried) return false
    if (!process.stdout.isTTY || !process.stdin.isTTY) return false

    console.log(chalk.yellow(`\n  Project "${args.config.name}" (${args.config.projectId}) no longer exists.`))
    const proceed = await confirm({ message: `Create a new project and re-link this directory?`, default: false })
    if (!proceed) process.exit(1)

    const newProject = await createRemoteProject(args.apiKey, args.config.name)
    writeProjectConfig(process.cwd(), { ...args.config, projectId: newProject.projectId })
    console.log(chalk.green(`  Re-linked to ${newProject.projectId}. Retrying deploy…\n`))
    return true
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
