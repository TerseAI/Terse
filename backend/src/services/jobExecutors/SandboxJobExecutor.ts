import logger from "../../common/logger"
import { getActiveDeployForProject } from "../../common/projectHelper"
import { SandboxRuntimeTelemetry } from "../../common/sandboxRuntimeTelemetry"
import { shellQuote } from "../../common/shellEscape"
import { db } from "../../loaders/prisma"
import { StreamEventEmitter } from "../../modules/agents/AgentRunner/StreamProcessor"
import { attachProjectDeployToRun } from "../../modules/agents/AgentRunner/runHistory"
import { appendProcessOutputSystemEvent, buildProcessOutputSystemEventId } from "../../modules/agents/systemEvents/processOutputSystemEvent"
import { createSandboxToken } from "../../modules/auth/helpers/apiTokens"
import { settings } from "../../settings"
import { AgentWithRelations } from "../../types/prisma"
import { getSocketIO } from "../CacheInvalidationService"
import { SecretService } from "../SecretService"
import { resolveRunStatus } from "../resolveRunStatus"
import { getSandboxProvider } from "../sandboxProvider"
import { SANDBOX_DEFAULT_OPTIONS } from "../sandboxProvider/ModalSandboxService"
import { Sandbox, SandboxService } from "../sandboxProvider/SandboxService"
import { runJournalDir } from "../sandboxProvider/runJournal"
import { sdkRuntimeExecutorRegistry } from "../sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import { type SandboxCommandResult, type SdkProjectRuntime, type SdkRuntimeExecutor, type SdkRuntimeExecutorContext } from "../sdkRuntimeExecutors/types"
import { SDK_SANDBOX_APP_NAME, runtimeSandboxUniqueName } from "../sdkSandboxLayerKeys"

import { JobExecutionContext, JobExecutionKind, JobExecutor, RunOutcome } from "./types"

type SdkSourceImageRecord = {
    recordId: string
    imageId: string
    runtime: SdkProjectRuntime
    cliVersion: string
}

export class SandboxJobExecutor implements JobExecutor {
    readonly kind: JobExecutionKind = "sandbox"

    private emitter: StreamEventEmitter | null = null

    private elapsed(startMs: number): string {
        return `${((performance.now() - startMs) / 1000).toFixed(2)}s`
    }

    private emitSandboxNaturalStop(): void {
        if (!this.emitter) return
        const now = Date.now()
        const responseId = "sandbox-run"
        this.emitter.emit({ type: "NaturalStop", id: `${responseId}-stop`, response_id: responseId, timestamp: now }, now)
    }

    async execute(context: JobExecutionContext): Promise<RunOutcome> {
        const { runId, agent, orgId, userId, user, jobName, restoreImageId, hookResume, enqueuedAtMs, scheduledForMs } = context
        const executionStart = performance.now()
        const sandboxProvider = getSandboxProvider()
        const telemetry = new SandboxRuntimeTelemetry({
            userId,
            organizationId: orgId,
            runId,
            jobId: agent.id,
            projectId: agent.project.id,
            jobName,
            mode: restoreImageId ? "resume" : "fresh",
            provider: sandboxProvider.supportsContainerizedRunners ? "containerized" : "local",
            enqueuedAtMs,
            scheduledForMs
        })

        this.emitter = new StreamEventEmitter(getSocketIO(), { runId, agentId: agent.id, user })

        let sandboxApiKey: string | undefined
        let sandboxTokenId: string | undefined
        let telemetrySuccess = false
        let telemetryError: unknown

        try {
            const sourceImage = await telemetry.measure("resolveSourceImageMs", () => this.resolveSourceImage({ agent, runId }))
            const executor = sdkRuntimeExecutorRegistry.resolveRuntime(sourceImage.runtime)
            telemetry.setRuntime(executor.runtime)

            const { rawToken, tokenId } = await telemetry.measure("createSandboxTokenMs", () => createSandboxToken({ userId, organizationId: orgId, projectId: agent.project.id }))
            sandboxApiKey = rawToken
            sandboxTokenId = tokenId
            logger.info("SDK sandbox: created temp API token", { runId, agentId: agent.id })

            const secretService = SecretService.getInstance()
            const projectSecretValues = await telemetry.measure("fetchProjectSecretsMs", () => secretService.getSecrets({ type: "project", secret: { projectId: agent.project.id } }))

            const sandboxBackendUrl = sandboxProvider.supportsContainerizedRunners ? settings.urls.backend : settings.urls.internalBackend

            const sandboxEnv: Record<string, string> = {
                // Make sure to keep this first as the sandbox env,
                // so that the following env variables take precedence.
                ...projectSecretValues,
                TERSE_API_KEY: sandboxApiKey,
                TERSE_BACKEND_URL: sandboxBackendUrl,
                TERSE_RUN_ID: runId,
                WORKFLOW_LOCAL_DATA_DIR: runJournalDir(runId),
                /** Exposes `terse run` in the CLI inside Modal sandboxes only (see packages/terse-cli). */
                TERSE_CLI_ENABLE_RUN: "1",
                NO_UPDATE_NOTIFIER: "1"
            }
            // Interim transport: the response payload rides sandbox env vars because there is no
            // server-side store for it yet. Once the shared Redis cache lands, stash the payload
            // there keyed by token and pass only the token; the CLI fetches it over the authed API.
            if (hookResume) {
                sandboxEnv.TERSE_RESUME_HOOK_TOKEN = hookResume.token
                sandboxEnv.TERSE_RESUME_HOOK_PAYLOAD = JSON.stringify(hookResume.payload)
            }

            const result = await this.executeWithSourceImage({
                executor,
                jobName,
                sandboxService: sandboxProvider,
                runId,
                projectId: agent.project.id,
                agentId: agent.id,
                sandboxEnv,
                sourceImageRecordId: sourceImage.recordId,
                cliVersion: sourceImage.cliVersion,
                restoreImageId,
                telemetry
            })

            logger.info("SDK sandbox: total execution finished", { runId, agentId: agent.id, runtime: executor.runtime, totalDuration: this.elapsed(executionStart) })

            const outcome = await telemetry.measure("resolveRunStatusMs", () => resolveRunStatus({ runId, agent, result, runtimeName: executor.runtime, telemetry }))
            telemetrySuccess = outcome.status !== "failed"
            if (outcome.status === "failed") telemetryError = outcome.cause
            return outcome
        } catch (error) {
            telemetryError = error
            logger.error("SDK job execution failed", {
                error,
                runId,
                agentId: agent.id,
                totalDuration: this.elapsed(executionStart)
            })

            return { status: "failed", cause: error }
        } finally {
            this.emitSandboxNaturalStop()
            if (sandboxTokenId) {
                await this.deleteSandboxApiToken(sandboxTokenId).catch(err => {
                    logger.warn("Failed to delete sandbox API token", { error: err, tokenId: sandboxTokenId })
                })
            }
            await telemetry.measure("terminateRunSandboxMs", () => this.terminateRunSandbox(agent.project.id, runId))
            telemetry.capture(telemetrySuccess, telemetryError)
        }
    }

    private async resolveSourceImage(params: { agent: AgentWithRelations; runId: string }): Promise<SdkSourceImageRecord> {
        const { agent, runId } = params
        // Single query — derive both the deploy attachment and the source image from the same snapshot.
        // If a new deploy lands between queue-time and now, this run executes against it consistently.
        const activeDeploy = await getActiveDeployForProject(agent.project.id)
        if (!activeDeploy?.sdk_source_image_id) {
            throw new Error(`SDK agent "${agent.id}" is missing an active source image`)
        }

        const sourceImage = await this.getSourceImageRecord(activeDeploy.sdk_source_image_id)
        if (!sourceImage) {
            throw new Error(`SDK source image row not found: ${activeDeploy.sdk_source_image_id}`)
        }

        await this.touchSourceImageUsage(sourceImage)
        await attachProjectDeployToRun(runId, activeDeploy.id)
        return sourceImage
    }

    private async getSourceImageRecord(sourceImageId: string): Promise<SdkSourceImageRecord | null> {
        const record = await db().sdk_source_images.findUnique({
            where: { id: sourceImageId },
            select: {
                id: true,
                image_id: true,
                runtime: true,
                cli_version: true
            }
        })

        if (!record) {
            return null
        }

        return {
            recordId: record.id,
            imageId: record.image_id,
            runtime: this.parseRuntime(record.runtime),
            cliVersion: record.cli_version
        }
    }

    private async touchSourceImageUsage(sourceImage: Pick<SdkSourceImageRecord, "recordId">): Promise<void> {
        await db().sdk_source_images.updateMany({
            where: { id: sourceImage.recordId },
            data: { last_used_at: new Date() }
        })
    }

    private async executeWithSourceImage(params: {
        executor: SdkRuntimeExecutor
        jobName: string
        sandboxService: SandboxService
        runId: string
        agentId: string
        projectId: string
        sandboxEnv: Record<string, string>
        sourceImageRecordId: string
        cliVersion: string
        restoreImageId?: string
        telemetry: SandboxRuntimeTelemetry
    }): Promise<SandboxCommandResult> {
        const { executor, jobName, sandboxService, runId, agentId, projectId, sandboxEnv, sourceImageRecordId, cliVersion, restoreImageId, telemetry } = params

        const sb = await telemetry.measure("createSourceImageSandboxMs", () => this.createSourceImageSandbox(sandboxService, sourceImageRecordId, projectId, runId, telemetry))
        if (restoreImageId) {
            await telemetry.measure("restoreSnapshotMs", () => sandboxService.restoreDirectory(sb, runJournalDir(runId), restoreImageId))
        }
        const executorContext = this.createRuntimeExecutorContext(sb, sandboxEnv, runId, agentId, jobName, sandboxService.getProjectPath(sb), sandboxService.getCliCachePath(sb), true, cliVersion)
        // A restored journal means we are resuming an existing run (`terse resume`), not dispatching a new one (`terse run`).
        const result = await telemetry.measure("runtimeCommandMs", () => (restoreImageId ? executor.resume(executorContext) : executor.execute(executorContext)))
        return result
    }

    private createRuntimeExecutorContext(
        sb: Sandbox,
        sandboxEnv: Record<string, string>,
        runId: string,
        agentId: string,
        jobName: string,
        projectDir: string,
        cliCachePath: string,
        usesPrebuiltImage: boolean,
        cliVersion: string
    ): SdkRuntimeExecutorContext {
        return {
            sb,
            sandboxEnv,
            runId,
            agentId,
            jobName,
            projectDir,
            cliCachePath,
            usesPrebuiltImage,
            cliVersion,
            ensureSandboxCommand: async (label, command) => {
                await this.ensureSandboxCommand(sb, label, command, sandboxEnv, runId, agentId)
            },
            runSandboxCommand: async (label, command) => {
                return this.runSandboxCommand(sb, label, command, sandboxEnv, runId, agentId)
            },
            runSandboxCommandStreaming: async (label, command) => {
                return this.runSandboxCommandStreaming(sb, label, command, sandboxEnv, runId, agentId)
            },
            escapeShellArg: shellQuote
        }
    }

    private async terminateRunSandbox(projectId: string, runId: string): Promise<void> {
        try {
            const sandboxService = getSandboxProvider()
            const app = await sandboxService.getOrCreateApp(SDK_SANDBOX_APP_NAME)
            await sandboxService.terminateSandbox(app, runtimeSandboxUniqueName(projectId, runId))
        } catch (error) {
            logger.warn("SDK sandbox: failed to terminate run sandbox", { projectId, runId, error })
        }
    }

    private async createSourceImageSandbox(sandboxService: SandboxService, sourceImageRecordId: string, projectId: string, runId: string, telemetry: SandboxRuntimeTelemetry): Promise<Sandbox> {
        const source = await this.getSourceImageRecord(sourceImageRecordId)
        if (!source) {
            throw new Error(`SDK source image row not found: ${sourceImageRecordId}`)
        }

        const app = await telemetry.measure("sandboxAppReadyMs", () => sandboxService.getOrCreateApp(SDK_SANDBOX_APP_NAME))
        const image = await telemetry.measure("sourceImageLoadMs", () => sandboxService.getImageFromId(source.imageId))
        const uniqueName = runtimeSandboxUniqueName(projectId, runId)
        return telemetry.measure("sandboxReadyMs", () => sandboxService.getOrCreateSandbox(app, image, uniqueName, SANDBOX_DEFAULT_OPTIONS))
    }

    private async ensureSandboxCommand(sb: Sandbox, label: string, command: string, sandboxEnv: Record<string, string>, runId: string, agentId: string): Promise<void> {
        const result = await this.runSandboxCommand(sb, label, command, sandboxEnv, runId, agentId)
        if (result.exitCode !== 0) {
            if (result.stderr.trim().length > 0) {
                await this.emitAndPersistProcessOutput(runId, {
                    label,
                    stream: "stderr",
                    content: result.stderr
                })
            }
            throw new Error(this.buildFailureMessage(label, result))
        }
    }

    private async runSandboxCommand(sb: Sandbox, label: string, command: string, sandboxEnv: Record<string, string>, runId: string, agentId: string): Promise<SandboxCommandResult> {
        const start = performance.now()
        logger.info("SDK sandbox: starting command", { runId, agentId, label, command })

        const proc = await sb.exec(["sh", "-c", command], {
            stdout: "pipe",
            stderr: "pipe",
            env: sandboxEnv
        })
        const [stdout, stderr] = await Promise.all([proc.stdout.readText(), proc.stderr.readText()])
        const exitCode = await proc.wait()

        logger.info("SDK sandbox: command finished", {
            runId,
            agentId,
            label,
            duration: this.elapsed(start),
            exitCode,
            stdout: this.clipOutput(stdout),
            stderr: this.clipOutput(stderr)
        })

        return { exitCode, stdout, stderr }
    }

    private async runSandboxCommandStreaming(sb: Sandbox, label: string, command: string, sandboxEnv: Record<string, string>, runId: string, agentId: string): Promise<SandboxCommandResult> {
        const start = performance.now()
        logger.info("SDK sandbox: starting streaming command", { runId, agentId, label, command })

        const proc = await sb.exec(["sh", "-c", command], {
            stdout: "pipe",
            stderr: "pipe",
            env: sandboxEnv
        })

        const pending = {
            stdout: "",
            stderr: ""
        }
        const full = {
            stdout: "",
            stderr: ""
        }
        const flushTimers: Partial<Record<"stdout" | "stderr", ReturnType<typeof setTimeout>>> = {}
        let persistQueue = Promise.resolve()

        const flushStream = (stream: "stdout" | "stderr") => {
            const content = pending[stream]
            pending[stream] = ""
            if (!content) {
                return
            }

            persistQueue = persistQueue.then(() =>
                this.emitAndPersistProcessOutput(runId, {
                    label,
                    stream,
                    content
                })
            )
        }

        const scheduleFlush = (stream: "stdout" | "stderr") => {
            if (flushTimers[stream]) {
                return
            }

            flushTimers[stream] = setTimeout(() => {
                flushTimers[stream] = undefined
                flushStream(stream)
            }, 200)
        }

        const consumeStream = async (stream: "stdout" | "stderr", readerSource: { getReader: () => ReadableStreamDefaultReader<string | Uint8Array> }) => {
            const reader = readerSource.getReader()

            try {
                while (true) {
                    const { value, done } = await reader.read()
                    if (done) {
                        break
                    }

                    const chunk = typeof value === "string" ? value : new TextDecoder().decode(value)
                    if (!chunk) {
                        continue
                    }

                    full[stream] += chunk
                    pending[stream] += chunk
                    scheduleFlush(stream)
                }
            } finally {
                if (flushTimers[stream]) {
                    clearTimeout(flushTimers[stream])
                    flushTimers[stream] = undefined
                }
                flushStream(stream)
                reader.releaseLock()
            }
        }

        await Promise.all([consumeStream("stdout", proc.stdout), consumeStream("stderr", proc.stderr)])
        const exitCode = await proc.wait()
        await persistQueue

        logger.info("SDK sandbox: streaming command finished", {
            runId,
            agentId,
            label,
            duration: this.elapsed(start),
            exitCode,
            stdout: this.clipOutput(full.stdout),
            stderr: this.clipOutput(full.stderr)
        })

        return {
            exitCode,
            stdout: full.stdout,
            stderr: full.stderr
        }
    }

    private async emitAndPersistProcessOutput(runId: string, input: { label: string; stream: "stdout" | "stderr"; content: string }): Promise<void> {
        const timestamp = Date.now()
        const id = buildProcessOutputSystemEventId()
        this.emitter?.emit(
            {
                type: "ProcessOutput",
                id,
                response_id: id,
                label: input.label,
                stream: input.stream,
                content: input.content,
                timestamp
            },
            timestamp
        )
        await appendProcessOutputSystemEvent(runId, { ...input, id })
    }

    private buildFailureMessage(label: string, result: SandboxCommandResult): string {
        const detail = [result.stderr.trim(), result.stdout.trim()].find(part => part.length > 0)
        if (!detail) {
            return `${label} failed (exit ${result.exitCode})`
        }

        return `${label} failed (exit ${result.exitCode}): ${detail.slice(0, 500)}`
    }

    private clipOutput(value: string, limit = 8000): string | undefined {
        const trimmed = value.trim()
        if (!trimmed) {
            return undefined
        }

        return trimmed.slice(0, limit)
    }

    private parseRuntime(runtime: string): SdkProjectRuntime {
        if (runtime === "typescript") {
            return runtime
        }

        throw new Error(`Unsupported SDK runtime: ${runtime}`)
    }

    private async deleteSandboxApiToken(tokenId: string): Promise<void> {
        await db().api_tokens.delete({
            where: { id: tokenId }
        })
    }
}
