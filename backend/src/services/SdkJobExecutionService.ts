import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { UserSession } from "terse-types/types"

import logger from "../common/logger"
import { getActiveDeployForProject } from "../common/projectHelper"
import { shellQuote } from "../common/shellEscape"
import { db } from "../loaders/prisma"
import { emitCacheInvalidationWithWildcard, finalizeRunFailure } from "../loaders/socket"
import { StreamEventEmitter } from "../modules/agents/AgentRunner/StreamProcessor"
import { attachProjectDeployToRun, finalizeRunStatus } from "../modules/agents/AgentRunner/runHistory"
import { classifyAgentError } from "../modules/agents/agentErrorUtils"
import { appendProcessOutputSystemEvent, buildProcessOutputSystemEventId } from "../modules/agents/systemEvents/processOutputSystemEvent"
import { createSandboxToken } from "../modules/auth/helpers/apiTokens"
import { settings } from "../settings"
import { AgentWithRelations } from "../types/prisma"

import { getSocketIO } from "./CacheInvalidationService"
import { SecretService } from "./SecretService"
import { getSandboxProvider } from "./sandboxProvider"
import { SANDBOX_DEFAULT_OPTIONS } from "./sandboxProvider/ModalSandboxService"
import { Sandbox, SandboxService } from "./sandboxProvider/SandboxService"
import { sdkRuntimeExecutorRegistry } from "./sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import { type SandboxCommandResult, type SdkProjectRuntime, type SdkRuntimeExecutor, type SdkRuntimeExecutorContext } from "./sdkRuntimeExecutors/types"
import { computeSourceLayerKey, MEMORY_MOUNT_PATH, runtimeSandboxUniqueName, SDK_SANDBOX_APP_NAME } from "./sdkSandboxLayerKeys"

interface SdkJobExecutionParams {
    runId: string
    agent: AgentWithRelations
    orgId: string
    userId: string
    user: UserSession
    jobName: string
}

type SdkSourceImageRecord = {
    recordId: string
    imageId: string
    runtime: SdkProjectRuntime
    dependencyImageId: string
    sourceLayerKey: string
    cliVersion: string
}

export { SDK_SANDBOX_APP_NAME }

export class SdkJobExecutionService {
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

    async execute(params: SdkJobExecutionParams): Promise<void> {
        const { runId, agent, userId, user, jobName } = params
        const executionStart = performance.now()

        this.emitter = new StreamEventEmitter(getSocketIO(), { runId, agentId: agent.id, user })

        let sandboxApiKey: string | undefined
        let sandboxTokenId: string | undefined
        const orgId = params.orgId

        try {
            const sourceImage = await this.resolveSourceImage({ agent, runId })
            const executor = sdkRuntimeExecutorRegistry.resolveRuntime(sourceImage.runtime)

            const { rawToken, tokenId } = await createSandboxToken({ userId, organizationId: orgId, projectId: agent.project.id })
            sandboxApiKey = rawToken
            sandboxTokenId = tokenId
            logger.info("SDK sandbox: created temp API token", { runId, agentId: agent.id })

            const secretService = SecretService.getInstance()
            const projectSecretValues = await secretService.getSecrets({ type: "project", secret: { projectId: agent.project.id } })

            const sandboxBackendUrl = getSandboxProvider().supportsContainerizedRunners ? settings.urls.backend : settings.urls.internalBackend

            const sandboxEnv = {
                // Make sure to keep this first as the sandbox env,
                // so that the following env variables take precedence.
                ...projectSecretValues,
                TERSE_API_KEY: sandboxApiKey,
                TERSE_BACKEND_URL: sandboxBackendUrl,
                TERSE_RUN_ID: runId,
                /** Exposes `terse run` in the CLI inside Modal sandboxes only (see packages/terse-cli). */
                TERSE_CLI_ENABLE_RUN: "1",
                NO_UPDATE_NOTIFIER: "1"
            }

            const result = await this.executeWithSourceImage({
                executor,
                jobName,
                sandboxService: getSandboxProvider(),
                runId,
                projectId: agent.project.id,
                agentId: agent.id,
                sandboxEnv,
                sourceImageRecordId: sourceImage.recordId,
                cliVersion: sourceImage.cliVersion
            })

            if (result.exitCode === 0) {
                await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agent.id)
                logger.info("SDK sandbox: terse run completed", { runId, agentId: agent.id, runtime: executor.runtime })
            } else {
                const errorMsg = result.stderr?.trim().slice(0, 500) || `Process exited with code ${result.exitCode}`
                await finalizeRunFailure(runId, classifyAgentError(new Error(errorMsg)), user, agent)
                logger.error("SDK sandbox: terse run failed", { runId, agentId: agent.id, exitCode: result.exitCode, runtime: executor.runtime })
            }

            logger.info("SDK sandbox: total execution finished", { runId, agentId: agent.id, runtime: executor.runtime, totalDuration: this.elapsed(executionStart) })
        } catch (error) {
            logger.error("SDK job execution failed", {
                error,
                runId,
                agentId: agent.id,
                totalDuration: this.elapsed(executionStart)
            })

            await finalizeRunFailure(runId, classifyAgentError(error), user, agent)
        } finally {
            this.emitSandboxNaturalStop()
            if (sandboxTokenId) {
                await this.deleteSandboxApiToken(sandboxTokenId).catch(err => {
                    logger.warn("Failed to delete sandbox API token", { error: err, tokenId: sandboxTokenId })
                })
            }
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
                dependency_image_id: true,
                organization_id: true,
                source_hash: true,
                dependency_image: { select: { dependency_hash: true, cli_version: true } }
            }
        })

        if (!record) {
            return null
        }

        const sourceLayerKey = computeSourceLayerKey({
            organizationId: record.organization_id,
            dependencyHash: record.dependency_image.dependency_hash,
            sourceHash: record.source_hash
        })

        return {
            recordId: record.id,
            imageId: record.image_id,
            runtime: this.parseRuntime(record.runtime),
            dependencyImageId: record.dependency_image_id,
            sourceLayerKey,
            cliVersion: record.dependency_image.cli_version
        }
    }

    private async touchSourceImageUsage(sourceImage: Pick<SdkSourceImageRecord, "recordId" | "dependencyImageId">): Promise<void> {
        const now = new Date()
        await db().$transaction([
            db().sdk_source_images.updateMany({
                where: { id: sourceImage.recordId },
                data: { last_used_at: now }
            }),
            db().sdk_dependency_images.updateMany({
                where: { id: sourceImage.dependencyImageId },
                data: { last_used_at: now }
            })
        ])
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
    }): Promise<SandboxCommandResult> {
        const { executor, jobName, sandboxService, runId, agentId, projectId, sandboxEnv, sourceImageRecordId, cliVersion } = params

        const sb = await this.createSourceImageSandbox(sandboxService, sourceImageRecordId, projectId)
        const executorContext = this.createRuntimeExecutorContext(sb, sandboxEnv, runId, agentId, jobName, sandboxService.getProjectPath(sb), sandboxService.getCliCachePath(sb), true, cliVersion)
        const result = await executor.execute(executorContext)
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

    private async createSourceImageSandbox(sandboxService: SandboxService, sourceImageRecordId: string, projectId: string): Promise<Sandbox> {
        const source = await this.getSourceImageRecord(sourceImageRecordId)
        if (!source) {
            throw new Error(`SDK source image row not found: ${sourceImageRecordId}`)
        }

        const app = await sandboxService.getOrCreateApp(SDK_SANDBOX_APP_NAME)
        const image = await sandboxService.getImageFromId(source.imageId)
        const uniqueName = runtimeSandboxUniqueName(projectId)
        const volume = await sandboxService.getOrCreateProjectVolume(projectId)
        logger.info("SDK sandbox: mounting project memory volume", { projectId, mountPath: MEMORY_MOUNT_PATH, uniqueName })
        return sandboxService.getOrCreateSandbox(app, image, uniqueName, { ...SANDBOX_DEFAULT_OPTIONS, volumes: { [MEMORY_MOUNT_PATH]: volume } })
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
