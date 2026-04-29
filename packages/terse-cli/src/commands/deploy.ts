import { intro, log, outro, spinner } from "@clack/prompts"
import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import { zipSync } from "fflate"
import fs from "node:fs"
import path from "node:path"
import { ApiRoutes, SdkDeployStage, sdkDeployRequestBodySchema } from "terse-types"
import type { SdkDeployResponseBody, TerseProjectConfig } from "terse-types"

import { ApiError, fetchWithAuthAndSession, readApiKeyOrBail } from "../api.js"
import { CliError } from "../cliError.js"
import { getCliVersion } from "../cliVersion.js"
import { FRONTEND_URL } from "../config.js"
import { loadJobRegistry } from "../loadJob.js"
import { PROJECT_CONFIG_FILENAME, createRemoteProject, readProjectConfigOrBail, writeProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { openSessionStream } from "../providers/shared/sessionStream.js"

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
        throw new CliError("remote_server_url_missing", "Self-hosted mode is enabled but no server URL is configured.", {
            detail: `Set \`remoteServerUrl\` in \`${PROJECT_CONFIG_FILENAME}\` to the URL where your Terse SDK is running.\n\nExample:\n  {\n    "projectId": "${projectId}",\n    "name": "${config.name}",\n    "selfHosted": true,\n    "remoteServerUrl": "https://your-app.example.com"\n  }`
        })
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

    intro(`terse deploy`)

    const s = spinner({ styleFrame: frame => chalk.hex("#04AB62")(frame) })

    // Open the SSE session BEFORE starting the spinner so a clean error
    // (e.g. 401) surfaces without leaving the spinner mid-frame.
    const session = await openSessionStream(apiKey, {
        onEvent: event => {
            if (event.type === "deploy_stage") {
                s.message(getStageMessage(event.stage))
            }
        }
    })

    s.start(`Deploying ${jobs.length} job${jobs.length === 1 ? "" : "s"}`)

    try {
        const body = sdkDeployRequestBodySchema.parse({
            projectId,
            cliVersion: getCliVersion(),
            jobs: jobs.map(job => ({
                jobName: job.name,
                triggers: job.triggers
            })),
            remoteServerUrl: isUrlMode ? remoteServerUrl : undefined,
            sourceZipBase64
        })

        const deployResult = await fetchWithAuthAndSession<SdkDeployResponseBody>(ApiRoutes.SDK.DEPLOY, apiKey, session.sessionId, body, "POST")

        s.stop(`Deployed ${deployResult.results.length} job${deployResult.results.length === 1 ? "" : "s"}`)

        for (const r of deployResult.results) {
            const verb = r.isUpdate ? "Updated" : "Created"
            const agentUrl = `${FRONTEND_URL}/agents/${r.automationId}`
            log.step(`${verb}: ${chalk.bold(r.jobName)}  ${chalk.dim(agentUrl)}`)
            if (r.triggers) {
                for (const t of r.triggers) {
                    if (t.metadata?.webhookUrl) {
                        log.info(`Webhook URL: ${chalk.cyan(t.metadata.webhookUrl)}`)
                    }
                }
            }
        }

        if (isUrlMode) {
            console.log(chalk.dim(`  Mode: user infrastructure`))
            console.log(chalk.dim(`  Server URL: ${remoteServerUrl}`))

            const signingSecret = deployResult.signingSecret
            const projectApiKey = deployResult.projectApiKey
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
            log.info(`Mode: user infrastructure  ${chalk.dim(remoteServerUrl!)}`)
        } else {
            log.info(`${fileCount} files  ${chalk.dim(`${(zipSizeBytes / 1024).toFixed(1)} KB`)}`)
        }

        if (deployResult.removed.length > 0) {
            log.warn(`Removed ${deployResult.removed.length} stale job${deployResult.removed.length === 1 ? "" : "s"}: ${deployResult.removed.map(r => r.name).join(", ")}`)
        }

        outro("Done")
    } catch (error) {
        s.stop(`Deploy failed: ${(error as Error).message}`)
        if (await tryRecoverStaleProject(error, { apiKey, config, hasRetried })) {
            return deploy(provider, entryFile, true)
        }

        if (isProjectGoneError(error)) {
            throw new CliError("project_not_found", `The project linked in ${PROJECT_CONFIG_FILENAME} no longer exists.`, {
                detail: `This usually means it was deleted from the dashboard, or this config came from another machine.\nRun \`terse attach\` to link this directory to an existing project.`
            })
        }
        if (error instanceof CliError) {
            throw error
        }

        throw new CliError("deploy_failed", "Deploy failed.", {
            detail: error instanceof Error ? error.message : String(error)
        })
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
        throw new CliError("no_files_to_deploy", "No files found to deploy")
    }

    const zipData = zipSync(files, { level: 6 })
    return {
        sourceZipBase64: Buffer.from(zipData).toString("base64"),
        fileCount,
        zipSizeBytes: zipData.length
    }
}

function getStageMessage(stage: SdkDeployStage): string {
    switch (stage) {
        case "UPLOADING_SOURCE":
            return "Uploading source"
        case "BUILDING_DEPENDENCY_IMAGE":
            return "Building dependency image"
        case "BUILDING_SOURCE_IMAGE":
            return "Building source image"
        case "CONFIGURING_AUTOMATIONS":
            return "Configuring automations"
        default: {
            const exhaustiveCheck: never = stage
            return exhaustiveCheck
        }
    }
}
