<<<<<<< Updated upstream
import { confirm } from "@inquirer/prompts"
=======
import { intro, log, note, outro, spinner } from "@clack/prompts"
>>>>>>> Stashed changes
import chalk from "chalk"
import { zipSync } from "fflate"
import fs from "node:fs"
import path from "node:path"
<<<<<<< Updated upstream
import ora from "ora"
import { ApiRoutes, sdkDeployRequestBodySchema } from "terse-types"
import type { SdkDeployResponseBody, TerseProjectConfig } from "terse-types"

import { ApiError, fetchWithAuth, readApiKeyOrBail } from "../api.js"
=======
import { ApiRoutes, SdkDeployResponseBody, SdkDeployStage, sdkDeployRequestBodySchema } from "terse-types"

import { readApiKeyOrBail, readEnvVar } from "../api.js"
import { BACKEND_URL, FRONTEND_URL } from "../config.js"
>>>>>>> Stashed changes
import { loadJobRegistry } from "../loadJob.js"
import { PROJECT_CONFIG_FILENAME, createRemoteProject, readProjectConfigOrBail, writeProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { openSessionStream } from "../providers/shared/sessionStream.js"

const stageMessages: Record<SdkDeployStage, string> = {
    UPLOADING_SOURCE: "Uploading source",
    BUILDING_DEPENDENCY_IMAGE: "Building dependency image",
    BUILDING_SOURCE_IMAGE: "Building source image",
    CONFIGURING_AUTOMATIONS: "Configuring automations"
}

function osc8Link(text: string, url: string): string {
    return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`
}

function supportsHyperlinks(): boolean {
    if (process.env.FORCE_HYPERLINK) return process.env.FORCE_HYPERLINK !== "0"
    const { TERM_PROGRAM, VTE_VERSION } = process.env
    return ["iTerm.app", "WezTerm", "vscode", "Hyper"].includes(TERM_PROGRAM ?? "") || !!VTE_VERSION
}

function agentLink(url: string): string {
    return supportsHyperlinks() ? osc8Link("Open →", url) : chalk.dim(url)
}

export async function deploy(provider: LanguageProvider = resolveProvider(), entryFile?: string, hasRetried = false) {
    const apiKey = readApiKeyOrBail({
        title: "Error: Not authenticated.",
        detail: "Run `terse login` to authenticate, or set TERSE_API_KEY in your environment."
    })

    const config = readProjectConfigOrBail()
    const { projectId } = config

    const registry = await loadJobRegistry(provider, entryFile)
    const jobs = [...registry.values()]

<<<<<<< Updated upstream
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

=======
    const remoteServerUrl = readEnvVar("TERSE_REMOTE_SERVER_URL") ?? readEnvVar("TERSE_JOB_URL")
>>>>>>> Stashed changes
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

    intro(`terse deploy`)

    const s = spinner({ styleFrame: frame => chalk.hex("#04AB62")(frame) })
    s.start(`Deploying ${jobs.length} job${jobs.length === 1 ? "" : "s"}`)

    const session = await openSessionStream(apiKey, {
        onEvent: event => {
            if (event.type === "deploy_stage") {
                s.message(stageMessages[event.stage])
            }
        }
    })

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

        const res = await fetch(`${BACKEND_URL}${ApiRoutes.SDK.DEPLOY}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-terse-session-id": session.sessionId
            },
            body: JSON.stringify(body)
        })

        const result = (await res.json()) as SdkDeployResponseBody

        if (!res.ok || !result.success) {
            s.stop(`Deploy failed: ${result.error ?? res.statusText}`)
            if (result.details) log.error(String(result.details))
            process.exit(1)
        }

        s.stop(`Deployed ${result.results.length} job${result.results.length === 1 ? "" : "s"}`)

        for (const r of result.results) {
            const verb = r.isUpdate ? "Updated" : "Created"
            const agentUrl = `${FRONTEND_URL}/agents/${r.automationId}`
            log.step(`${verb}: ${chalk.bold(r.jobName)}  ${agentLink(agentUrl)}`)
            if (r.triggers) {
                for (const t of r.triggers) {
                    if (t.metadata?.webhookUrl) {
                        log.info(`Webhook URL: ${chalk.cyan(t.metadata.webhookUrl)}`)
                    }
                }
            }
        }

        if (isUrlMode) {
<<<<<<< Updated upstream
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
=======
            const signingSecret = result.results.find(r => r.signingSecret)?.signingSecret
            if (signingSecret && !readEnvVar("TERSE_SIGNING_SECRET")) {
                note(`TERSE_SIGNING_SECRET=${signingSecret}`, "Add to your .env file")
>>>>>>> Stashed changes
            }
            log.info(`Mode: user infrastructure  ${chalk.dim(remoteServerUrl!)}`)
        } else {
            log.info(`${fileCount} files  ${chalk.dim(`${(zipSizeBytes / 1024).toFixed(1)} KB`)}`)
        }

        if (result.removed.length > 0) {
            log.warn(`Removed ${result.removed.length} stale job${result.removed.length === 1 ? "" : "s"}: ${result.removed.map(r => r.name).join(", ")}`)
        }

        outro("Done")
    } catch (error) {
<<<<<<< Updated upstream
        spinner.stop()
        if (await tryRecoverStaleProject(error, { apiKey, config, hasRetried })) {
            return deploy(provider, entryFile, true)
        }

        spinner.fail(chalk.red(`Deploy failed: ${(error as Error).message}`))
        if (isProjectGoneError(error)) {
            console.error(chalk.dim(`  Run ${chalk.cyan("terse attach")} to link this directory to an existing project.`))
        }
=======
        s.stop(`Deploy failed: ${(error as Error).message}`)
>>>>>>> Stashed changes
        process.exit(1)
    } finally {
        session.close()
    }
}

function isProjectGoneError(error: unknown): error is ApiError {
    return error instanceof ApiError && error.status === 404 && error.body.errorCode === "PROJECT_NOT_FOUND"
}

async function tryRecoverStaleProject(error: unknown, args: { apiKey: string; config: TerseProjectConfig; hasRetried: boolean }): Promise<boolean> {
    if (!isProjectGoneError(error)) return false
    if (args.hasRetried) return false
    if (!process.stdout.isTTY || !process.stdin.isTTY) return false

    console.log(chalk.yellow(`\n  The project linked in ${PROJECT_CONFIG_FILENAME} no longer exists.`))
    console.log(`  This usually means it was deleted from the dashboard, or this config came from another machine.`)
    console.log(chalk.dim(`\n  Project: "${args.config.name}" (${args.config.projectId})\n`))
    const proceed = await confirm({ message: `Create a new project named "${args.config.name}" and re-link this directory?`, default: false })
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
