import { cancel, intro, isCancel, log, multiselect, outro } from "@clack/prompts"
import { confirm } from "@inquirer/prompts"
import chalk from "chalk"
import dotenv from "dotenv"
import { zipSync } from "fflate"
import fs from "node:fs"
import path from "node:path"
import { ApiRoutes, SdkDeployStage, SdkSourceUploadResponse, buildRoute, sdkDeployRequestBodySchema, validateSecretName, validateSecretValue } from "terse-types"
import type { ProjectSecretUpsertRequest, ProjectSecretsImportResponse, ProjectSecretsListResponse, SdkDeployResponseBody, TerseProjectConfig } from "terse-types"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

import { ApiError, fetchWithAuth, fetchWithAuthAndSession, readApiKeyOrBail } from "../api.js"
import { CliError } from "../cliError.js"
import { isNonInteractive } from "../cliHelpers.js"
import { createSpinner } from "../cliUi.js"
import { getCliVersion } from "../cliVersion.js"
import { FRONTEND_URL } from "../config.js"
import { loadJobRegistry } from "../loadJob.js"
import { PROJECT_CONFIG_FILENAME, createRemoteProject, readProjectConfigOrBail, writeProjectConfig } from "../projectConfig.js"
import type { LanguageProvider } from "../providers/LanguageProvider.js"
import { resolveProvider } from "../providers/resolveProvider.js"
import { openSessionStream } from "../providers/shared/sessionStream.js"

// Base64 in a JSON body: fine for a source-only project, not for one carrying data files.
const MAX_INLINE_ARCHIVE_BYTES = 8 * 1024 * 1024

export async function deploy(provider: LanguageProvider = resolveProvider(), entryFile?: string, hasRetried = false) {
    const apiKey = readApiKeyOrBail({
        title: "Error: Not authenticated.",
        detail: "Run `terse auth login` to authenticate, or set TERSE_API_KEY in your environment."
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

    intro(`terse deploy`)

    const typecheckSpinner = createSpinner()
    typecheckSpinner.start("Type-checking")
    try {
        await provider.typecheck()
        typecheckSpinner.stop("Type-check passed")
    } catch (error) {
        typecheckSpinner.stop("Type-check failed")
        throw error
    }

    if (!config.selfHosted) {
        await syncMissingLocalSecrets({ projectId, apiKey })
    }

    const s = createSpinner()
    const timeline = new DeployTimeline()

    // Open the SSE session BEFORE starting the spinner so a clean error
    // (e.g. 401) surfaces without leaving the spinner mid-frame.
    const session = await openSessionStream(apiKey, {
        onEvent: event => {
            if (event.type === "deploy_stage") {
                timeline.enter(event.stage)
                s.message(`${getStageMessage(event.stage)} ${chalk.dim(`(${timeline.elapsed()})`)}`)
            }
        }
    })

    // Timing starts here, before the archive is zipped and uploaded: the user waits for both, so
    // leaving them outside the timeline reports a total shorter than the deploy they sat through.
    timeline.start()
    s.start(`Deploying ${jobs.length} job${jobs.length === 1 ? "" : "s"}`)

    let sourceArchive: { sourceObjectKey?: string; sourceZipBase64?: string } = {}
    let fileCount = 0
    let zipSizeBytes = 0

    if (!isUrlMode) {
        timeline.enter("PACKAGING_PROJECT")
        s.message(getStageMessage("PACKAGING_PROJECT"))
        // Asking for the upload URL is a round trip that does not need the archive, so it runs
        // while the project is being zipped.
        const session = requestUploadSession(apiKey)
        const zipPayload = buildZipPayload(provider)
        fileCount = zipPayload.fileCount
        zipSizeBytes = zipPayload.zipSizeBytes

        timeline.enter("UPLOADING_SOURCE")
        s.message(`${getStageMessage("UPLOADING_SOURCE")} ${chalk.dim(formatBytes(zipSizeBytes))}`)
        sourceArchive = await uploadSource(zipPayload.zipBytes, session)
    }

    try {
        const body = sdkDeployRequestBodySchema.parse({
            projectId,
            cliVersion: getCliVersion(),
            jobs: jobs.map(job => ({
                jobName: job.name,
                triggers: job.triggers
            })),
            remoteServerUrl: isUrlMode ? remoteServerUrl : undefined,
            // Only the durable runtime reads .terse/wf, so the build can skip compiling one.
            requiresWorkflowBundle: jobs.some(job => provider.runtimeName(job) === "durable"),
            ...sourceArchive
        })

        const deployResult = await fetchWithAuthAndSession<SdkDeployResponseBody>(ApiRoutes.SDK.DEPLOY, apiKey, session.sessionId, body, "POST")

        timeline.finish()
        s.stop(`Deployed ${deployResult.results.length} job${deployResult.results.length === 1 ? "" : "s"} in ${timeline.elapsed()}`)
        timeline.printBreakdown()

        for (const r of deployResult.results) {
            const verb = r.isUpdate ? "Updated" : "Created"
            const jobUrl = `${FRONTEND_URL}${buildRoute(FrontendRoutes.JOBS.BY_ID, { id: r.automationId })}`
            log.step(`${verb}: ${chalk.bold(r.jobName)}  ${chalk.dim(jobUrl)}`)
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
        const reason = extractDeployFailureReason(error)
        s.stop("Deploy failed")
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

        throw new CliError("deploy_failed", "Deploy failed.", { detail: reason })
    } finally {
        session.close()
    }
}

function isProjectGoneError(error: unknown): error is ApiError {
    return error instanceof ApiError && error.status === 404 && error.body.errorCode === "PROJECT_NOT_FOUND"
}

function extractDeployFailureReason(error: unknown): string {
    if (error instanceof ApiError && typeof error.body.details === "string") {
        return error.body.details
    }
    return error instanceof Error ? error.message : String(error)
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

    const { config: newProject } = await createRemoteProject(args.apiKey, args.config.name, args.config.selfHosted)
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

        if (entry.isDirectory()) {
            Object.assign(entries, collectFiles(fullPath, baseDir, provider))
        } else if (entry.isFile()) {
            entries[path.relative(baseDir, fullPath).split(path.sep).join("/")] = new Uint8Array(fs.readFileSync(fullPath))
        }
    }

    return entries
}

function buildZipPayload(provider: LanguageProvider): { zipBytes: Uint8Array; fileCount: number; zipSizeBytes: number } {
    const cwd = process.cwd()
    const files = collectFiles(cwd, cwd, provider)
    const fileCount = Object.keys(files).length

    if (fileCount === 0) {
        throw new CliError("no_files_to_deploy", "No files found to deploy")
    }

    const zipData = zipSync(files, { level: 6 })
    return { zipBytes: zipData, fileCount, zipSizeBytes: zipData.length }
}

/**
 * Object storage first, so a project carrying data files never rides inside the deploy request:
 * base64 in JSON inflates it by a third and buffers the whole thing in the control plane. A
 * control plane without object storage (self-host) says so, and the archive goes inline instead.
 *
 * The URL is a GCS resumable session created by the control plane, which accepts the whole archive
 * in one request; 120MB uploads in about 4s. Note that @google-cloud/storage cannot replace this
 * fetch: its chunked path rejects a session it did not create itself (it bails after a valid 308),
 * and its working path is this same single PUT, which is not worth a 10MB dependency in a CLI.
 */
function requestUploadSession(apiKey: string): Promise<SdkSourceUploadResponse> {
    return fetchWithAuth<SdkSourceUploadResponse>(ApiRoutes.SDK.DEPLOY_SOURCE_UPLOAD, apiKey, {}, "POST")
}

async function uploadSource(zipBytes: Uint8Array, session: Promise<SdkSourceUploadResponse>): Promise<{ sourceObjectKey?: string; sourceZipBase64?: string }> {
    let reason: string
    try {
        const response = await session
        if (!response.upload) return inlineArchive(zipBytes, "this Terse server has no object storage configured")

        const upload = response.upload
        const put = await fetch(upload.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": upload.contentType },
            body: zipBytes
        })

        if (put.ok) return { sourceObjectKey: upload.objectKey }
        reason = `storage rejected the upload: ${put.status} ${(await put.text().catch(() => "")).slice(0, 200)}`
    } catch (error) {
        reason = error instanceof Error ? error.message : String(error)
    }

    return inlineArchive(zipBytes, reason)
}

/** The legacy path: still what older CLIs use, and the fallback when object storage is unavailable. */
function inlineArchive(zipBytes: Uint8Array, reason: string): { sourceZipBase64: string } {
    if (zipBytes.byteLength > MAX_INLINE_ARCHIVE_BYTES) {
        throw new CliError("source_upload_failed", `Could not upload this project (${(zipBytes.byteLength / 1024 / 1024).toFixed(0)}MB), and it is too large to send inline.`, { detail: reason })
    }

    // Small enough to send inline, so the deploy still works, but say why the fast path was skipped.
    log.warn(`Uploading inline: ${reason}`)
    return { sourceZipBase64: Buffer.from(zipBytes).toString("base64") }
}

async function syncMissingLocalSecrets(args: { projectId: string; apiKey: string }): Promise<void> {
    const envPath = path.join(process.cwd(), ".env")
    if (!fs.existsSync(envPath)) return

    const eligible = readEligibleLocalEnv(envPath)
    if (eligible.length === 0) return

    let remoteNames: Set<string>
    try {
        const response = await fetchWithAuth<ProjectSecretsListResponse>(buildRoute(ApiRoutes.PROJECT_SECRETS.LIST, { id: args.projectId }), args.apiKey)
        remoteNames = new Set(response.secrets.map(secret => secret.name))
    } catch (error) {
        log.warn(`Could not check project secrets — skipping sync. ${error instanceof Error ? error.message : String(error)}`)
        return
    }

    const missing = eligible.filter(entry => !remoteNames.has(entry.name))
    if (missing.length === 0) return

    if (isNonInteractive()) {
        log.warn(`Skipping secret sync (non-interactive). Missing on server: ${missing.map(m => m.name).join(", ")}. Run \`terse secrets import .env\` to upload.`)
        return
    }

    const selected = await multiselect<string>({
        message: `Upload ${missing.length} new secret${missing.length === 1 ? "" : "s"} from .env before deploy?`,
        options: missing.map(entry => ({ value: entry.name, label: entry.name })),
        initialValues: missing.map(entry => entry.name),
        required: false
    })

    if (isCancel(selected)) {
        cancel("Deploy cancelled.")
        process.exit(0)
    }

    if (selected.length === 0) {
        log.info("No secrets uploaded.")
        return
    }

    const entries = missing.filter(entry => selected.includes(entry.name))
    try {
        await fetchWithAuth<ProjectSecretsImportResponse>(buildRoute(ApiRoutes.PROJECT_SECRETS.IMPORT, { id: args.projectId }), args.apiKey, { entries }, "POST")
    } catch (error) {
        throw new CliError("secret_sync_failed", "Failed to upload secrets before deploy.", {
            detail: error instanceof Error ? error.message : String(error)
        })
    }

    log.info(`Uploaded ${entries.length} secret${entries.length === 1 ? "" : "s"}: ${entries.map(e => e.name).join(", ")}`)
}

function readEligibleLocalEnv(envPath: string): ProjectSecretUpsertRequest[] {
    let raw: string
    try {
        raw = fs.readFileSync(envPath, "utf-8")
    } catch (error) {
        log.warn(`Could not read .env — skipping secret sync. ${error instanceof Error ? error.message : String(error)}`)
        return []
    }

    const parsed = dotenv.parse(raw)
    const entries: ProjectSecretUpsertRequest[] = []
    for (const [name, value] of Object.entries(parsed)) {
        if (validateSecretName(name)) continue
        if (validateSecretValue(value)) continue
        entries.push({ name, value })
    }
    return entries
}

function getStageMessage(stage: SdkDeployStage): string {
    switch (stage) {
        case "PACKAGING_PROJECT":
            return "Packaging your project"
        case "PREPARING_BUILD":
            return "Checking for a cached build"
        case "REUSING_CACHED_BUILD":
            return "Reusing the cached build"
        case "STARTING_SANDBOX":
            return "Starting a build sandbox"
        case "UPLOADING_SOURCE":
            return "Uploading your project"
        case "BUILDING_PROJECT":
            return "Building your project"
        case "SAVING_IMAGE":
            return "Saving the build image"
        case "CONFIGURING_AUTOMATIONS":
            return "Setting up jobs"
        default: {
            const exhaustiveCheck: never = stage
            return exhaustiveCheck
        }
    }
}

/**
 * Deploy timing as the user experiences it: wall clock from the CLI, not the server's view, so
 * upload and round trips are included. A stage's duration ends when the next one starts, and the
 * breakdown is only worth printing when a build actually happened.
 */
class DeployTimeline {
    private startedAtMs = 0
    private currentStage: { stage: SdkDeployStage; startedAtMs: number } | undefined
    private readonly completed: Array<{ stage: SdkDeployStage; durationMs: number }> = []
    private totalMs: number | undefined

    start(): void {
        this.startedAtMs = Date.now()
    }

    enter(stage: SdkDeployStage): void {
        this.closeCurrentStage()
        this.currentStage = { stage, startedAtMs: Date.now() }
    }

    finish(): void {
        this.closeCurrentStage()
        this.totalMs = Date.now() - this.startedAtMs
    }

    elapsed(): string {
        return formatDuration((this.totalMs ?? Date.now() - this.startedAtMs) / 1000)
    }

    printBreakdown(): void {
        // A cached deploy is two blinks and a total; a per-stage table would be noise.
        if (this.completed.length < 2) return

        for (const { stage, durationMs } of this.completed) {
            console.log(chalk.dim(`    ${getStageMessage(stage).padEnd(30)} ${formatDuration(durationMs / 1000)}`))
        }
    }

    private closeCurrentStage(): void {
        if (!this.currentStage) return
        this.completed.push({ stage: this.currentStage.stage, durationMs: Date.now() - this.currentStage.startedAtMs })
        this.currentStage = undefined
    }
}

function formatBytes(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function formatDuration(seconds: number): string {
    if (seconds < 10) return `${seconds.toFixed(1)}s`
    if (seconds < 60) return `${Math.round(seconds)}s`
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}
