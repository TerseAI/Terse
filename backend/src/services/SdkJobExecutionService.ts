import crypto from "crypto"
import { ModalClient, Sandbox } from "modal"
import { ModelEvent, SANDBOX_STAGE_LABELS, SandboxStage, ToolCallExecutionStatus } from "terse-types/ModelEvents"
import { RunHistoryStatus } from "terse-types/RunHistoryTypes"
import { User } from "terse-types/types"

import { StreamEventEmitter } from "../agent/AgentRunner/StreamProcessor"
import { attachSdkSourceImageToRun, finalizeRunStatus, markRunFailed } from "../agent/AgentRunner/runHistory"
import { appendProcessOutputSystemEvent, buildProcessOutputSystemEventId } from "../agent/systemEvents/processOutputSystemEvent"
import { settings } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { extractErrorMessage } from "../utility/strings"

import { getSocketIO } from "./CacheInvalidationService"
import { downloadSdkDeployZip } from "./FileStorageService"
import { SdkSandboxImageService } from "./SdkSandboxImageService"
import { sdkRuntimeExecutorRegistry } from "./sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import {
    SDK_SANDBOX_EVENT_FILE_PATH,
    SDK_SOURCE_IMAGE_PROJECT_DIR,
    type SandboxCommandResult,
    type SdkProjectRuntime,
    type SdkRuntimeExecutor,
    type SdkRuntimeExecutorContext
} from "./sdkRuntimeExecutors/types"

export interface SdkJobExecutionParams {
    gcsKey: string
    runId: string
    agentId: string
    orgId: string
    userId: string
    user: User
    eventJson: string
    jobName: string
}

type ResolvedSdkSourceImage = {
    recordId: string
    modalImageId: string
    runtime: SdkProjectRuntime
    dependencyImageId: string
    zipBuffer?: Buffer
}

export class SdkJobExecutionService {
    private emitter: StreamEventEmitter | null = null

    private elapsed(startMs: number): string {
        return `${((performance.now() - startMs) / 1000).toFixed(2)}s`
    }

    private elapsedMs(startMs: number): number {
        return Math.round(performance.now() - startMs)
    }

    private emitSandboxStatus(stage: SandboxStage, status: "started" | "completed" | "failed", opts?: { duration_ms?: number; detail?: string }): void {
        if (!this.emitter) return
        const now = Date.now()
        const stepId = `sandbox-${stage}`
        const label = SANDBOX_STAGE_LABELS[stage]

        if (status === "started") {
            this.emitter.emit({ type: "ToolCallGenerating", tool_name: label, step_id: stepId, timestamp: now }, now)
            this.emitter.emit({ type: "ToolCall", summary: label, step_id: stepId, parameters: "", integration: "sandbox", timestamp: now }, now)
            return
        }

        const durationStr = opts?.duration_ms !== undefined ? `${(opts.duration_ms / 1000).toFixed(1)}s` : undefined
        const result = status === "completed" ? durationStr : `Failed: ${opts?.detail ?? "Unknown error"}${durationStr ? ` (${durationStr})` : ""}`

        const event: ModelEvent = {
            type: "ToolCallComplete",
            tool_name: label,
            step_id: stepId,
            status: status === "completed" ? ToolCallExecutionStatus.COMPLETED : ToolCallExecutionStatus.FAILED,
            changed_items: [],
            integration: "sandbox",
            result,
            timestamp: now,
            ...(status === "failed" && opts?.detail ? { errorContext: { error: opts.detail } } : {})
        }
        this.emitter.emit(event, now)
    }

    async execute(params: SdkJobExecutionParams): Promise<void> {
        const { gcsKey, runId, agentId, orgId, userId, user, eventJson, jobName } = params
        const executionStart = performance.now()

        this.emitter = new StreamEventEmitter(getSocketIO(), { runId, agentId, user })

        let sandboxApiKey: string | undefined
        let sandboxTokenId: string | undefined

        try {
            let sourceImage = await this.resolveOrPrepareSourceImage({ agentId, gcsKey, orgId, runId })
            let executor = sdkRuntimeExecutorRegistry.resolveRuntime(sourceImage.runtime)

            const { rawToken, tokenId } = await this.createSandboxApiToken(userId, orgId)
            sandboxApiKey = rawToken
            sandboxTokenId = tokenId
            logger.info("SDK sandbox: created temp API token", { runId, agentId })

            void this.cleanupStaleSandboxTokens(orgId).catch(err => {
                logger.warn("Failed to cleanup stale sandbox tokens", { error: err })
            })

            const sandboxEnv = {
                TERSE_API_KEY: sandboxApiKey,
                TERSE_BACKEND_URL: settings.urls.backend ?? "http://localhost:3001",
                TERSE_RUN_ID: runId,
                NO_UPDATE_NOTIFIER: "1"
            }

            const modal = this.createModalClient()
            const result = await this.executeWithSourceImage({
                executor,
                eventJson,
                jobName,
                modal,
                runId,
                agentId,
                sandboxEnv,
                sourceImageModalId: sourceImage.modalImageId
            })

            if (result.exitCode === 0) {
                await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
                logger.info("SDK sandbox: terse run completed", { runId, agentId, runtime: executor.runtime })
            } else {
                const errorMsg = result.stderr?.trim().slice(0, 500) || `Process exited with code ${result.exitCode}`
                await markRunFailed(runId, errorMsg, "agent")
                logger.error("SDK sandbox: terse run failed", { runId, agentId, exitCode: result.exitCode, runtime: executor.runtime })
            }

            emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
            logger.info("SDK sandbox: total execution finished", { runId, agentId, runtime: executor.runtime, totalDuration: this.elapsed(executionStart) })
        } catch (error) {
            const errorMessage = extractErrorMessage(error)
            logger.error("SDK job execution failed", { error, runId, agentId, totalDuration: this.elapsed(executionStart) })

            try {
                await markRunFailed(runId, errorMessage, "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
            } catch (persistError) {
                logger.error("Failed to mark run as failed after SDK execution error", { error: persistError, runId })
            }
        } finally {
            if (sandboxTokenId) {
                await this.deleteSandboxApiToken(sandboxTokenId).catch(err => {
                    logger.warn("Failed to delete sandbox API token", { error: err, tokenId: sandboxTokenId })
                })
            }
        }
    }

    private async resolveOrPrepareSourceImage(params: { agentId: string; gcsKey: string; orgId: string; runId: string }): Promise<ResolvedSdkSourceImage> {
        const { agentId, gcsKey, orgId, runId } = params
        const prompt = await db().automation_prompts.findUnique({
            where: { automation_id: agentId },
            select: { current_sdk_source_image_id: true }
        })

        if (prompt?.current_sdk_source_image_id) {
            const sourceImage = await this.getSourceImageRecord(prompt.current_sdk_source_image_id)
            if (sourceImage) {
                await this.touchSourceImageUsage(sourceImage)
                await attachSdkSourceImageToRun(runId, sourceImage.recordId)
                return sourceImage
            }

            logger.warn("SDK sandbox: prompt referenced missing sdk_source_images row, rebuilding from GCS", {
                agentId,
                runId,
                sourceImageId: prompt.current_sdk_source_image_id
            })
        }

        const zipBuffer = await this.downloadSourceZipFromGcs(gcsKey, runId, agentId)
        return this.prepareAndLinkSourceImage({ agentId, gcsKey, orgId, runId, zipBuffer })
    }

    private async prepareAndLinkSourceImage(params: { agentId: string; gcsKey: string; orgId: string; runId: string; zipBuffer: Buffer }): Promise<ResolvedSdkSourceImage> {
        const { agentId, gcsKey, orgId, runId, zipBuffer } = params
        const preparedImages = await new SdkSandboxImageService().prepareFromSourceZip({
            zipBuffer,
            gcsKey,
            organizationId: orgId
        })

        await db().automation_prompts.upsert({
            where: { automation_id: agentId },
            update: {
                current_sdk_source_image_id: preparedImages.sourceImageId,
                source_code_gcs_key: gcsKey
            },
            create: {
                automation_id: agentId,
                content: "[SDK]",
                current_sdk_source_image_id: preparedImages.sourceImageId,
                source_code_gcs_key: gcsKey
            }
        })

        await attachSdkSourceImageToRun(runId, preparedImages.sourceImageId)

        const sourceImage = await this.getSourceImageRecord(preparedImages.sourceImageId)
        if (!sourceImage) {
            throw new Error(`Prepared SDK source image ${preparedImages.sourceImageId} was not found`)
        }

        return {
            ...sourceImage,
            zipBuffer
        }
    }

    private async getSourceImageRecord(sourceImageId: string): Promise<ResolvedSdkSourceImage | null> {
        const record = await db().sdk_source_images.findUnique({
            where: { id: sourceImageId },
            select: {
                id: true,
                modal_image_id: true,
                runtime: true,
                dependency_image_id: true
            }
        })

        if (!record) {
            return null
        }

        return {
            recordId: record.id,
            modalImageId: record.modal_image_id,
            runtime: this.parseRuntime(record.runtime),
            dependencyImageId: record.dependency_image_id
        }
    }

    private async touchSourceImageUsage(sourceImage: Pick<ResolvedSdkSourceImage, "recordId" | "dependencyImageId">): Promise<void> {
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
        eventJson: string
        jobName: string
        modal: ModalClient
        runId: string
        agentId: string
        sandboxEnv: Record<string, string>
        sourceImageModalId: string
    }): Promise<SandboxCommandResult> {
        const { executor, eventJson, jobName, modal, runId, agentId, sandboxEnv, sourceImageModalId } = params

        this.emitSandboxStatus(SandboxStage.BOOTING, "started")
        const bootStart = performance.now()

        let sb: Sandbox
        try {
            sb = await this.createSourceImageSandbox(modal, sourceImageModalId)
            this.emitSandboxStatus(SandboxStage.BOOTING, "completed", { duration_ms: this.elapsedMs(bootStart) })
        } catch (error) {
            this.emitSandboxStatus(SandboxStage.BOOTING, "failed", {
                duration_ms: this.elapsedMs(bootStart),
                detail: extractErrorMessage(error)
            })
            throw error
        }

        logger.info("SDK sandbox: created Modal sandbox from source image", {
            runId,
            agentId,
            sandboxId: sb.sandboxId,
            runtime: executor.runtime,
            image: sourceImageModalId,
            duration: this.elapsed(bootStart)
        })

        try {
            const executorContext = this.createRuntimeExecutorContext(sb, sandboxEnv, runId, agentId, jobName, SDK_SOURCE_IMAGE_PROJECT_DIR, true)
            await this.writeEventFile(sb, eventJson)
            const result = await executor.execute(executorContext)
            return result
        } finally {
            await sb.terminate().catch(() => {})
        }
    }

    private async downloadSourceZipFromGcs(gcsKey: string, runId: string, agentId: string): Promise<Buffer> {
        this.emitSandboxStatus(SandboxStage.DOWNLOADING_SOURCE, "started")
        const start = performance.now()

        const zipBuffer = await downloadSdkDeployZip(gcsKey)
        if (!zipBuffer) {
            this.emitSandboxStatus(SandboxStage.DOWNLOADING_SOURCE, "failed", {
                duration_ms: this.elapsedMs(start),
                detail: "Failed to download SDK deploy zip from GCS"
            })
            throw new Error("Failed to download SDK deploy zip from GCS")
        }

        this.emitSandboxStatus(SandboxStage.DOWNLOADING_SOURCE, "completed", { duration_ms: this.elapsedMs(start) })
        logger.info("SDK sandbox: downloaded zip from GCS", {
            runId,
            agentId,
            gcsKey,
            duration: this.elapsed(start),
            sizeBytes: zipBuffer.length
        })

        return zipBuffer
    }

    private async writeEventFile(sb: Sandbox, eventJson: string): Promise<void> {
        const eventHandle = await sb.open(SDK_SANDBOX_EVENT_FILE_PATH, "w")
        await eventHandle.write(new TextEncoder().encode(eventJson))
        await eventHandle.close()
    }

    private createRuntimeExecutorContext(
        sb: Sandbox,
        sandboxEnv: Record<string, string>,
        runId: string,
        agentId: string,
        jobName: string,
        projectDir: string,
        usesPrebuiltImage: boolean
    ): SdkRuntimeExecutorContext {
        return {
            sb,
            sandboxEnv,
            runId,
            agentId,
            jobName,
            projectDir,
            eventFilePath: SDK_SANDBOX_EVENT_FILE_PATH,
            usesPrebuiltImage,
            ensureSandboxCommand: async (label, command) => {
                await this.ensureSandboxCommand(sb, label, command, sandboxEnv, runId, agentId)
            },
            runSandboxCommand: async (label, command) => {
                return this.runSandboxCommand(sb, label, command, sandboxEnv, runId, agentId)
            },
            runSandboxCommandStreaming: async (label, command) => {
                return this.runSandboxCommandStreaming(sb, label, command, sandboxEnv, runId, agentId)
            },
            escapeShellArg: value => this.escapeShellArg(value),
            emitSandboxStatus: (stage, status, opts) => this.emitSandboxStatus(stage, status, opts)
        }
    }

    private async createSourceImageSandbox(modal: ModalClient, sourceImageModalId: string): Promise<Sandbox> {
        const app = await modal.apps.fromName("terse-sdk-sandbox", { createIfMissing: true })
        const image = await modal.images.fromId(sourceImageModalId)
        return modal.sandboxes.create(app, image, { timeoutMs: 30 * 60 * 1000 })
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

    private escapeShellArg(value: string): string {
        return `'${value.replace(/'/g, "'\\''")}'`
    }

    private parseRuntime(runtime: string): SdkProjectRuntime {
        if (runtime === "typescript" || runtime === "python") {
            return runtime
        }

        throw new Error(`Unsupported SDK runtime: ${runtime}`)
    }

    private createModalClient(): ModalClient {
        return new ModalClient({
            tokenId: settings.modal.tokenId,
            tokenSecret: settings.modal.tokenSecret
        })
    }

    private async createSandboxApiToken(userId: string, organizationId: string): Promise<{ rawToken: string; tokenId: string }> {
        const rawToken = `terse_${crypto.randomBytes(32).toString("hex")}`
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
        const tokenPrefix = rawToken.slice(0, 14)

        const token = await db().api_tokens.create({
            data: {
                user_id: userId,
                organization_id: organizationId,
                name: "sdk-sandbox-runner",
                token_hash: tokenHash,
                token_prefix: tokenPrefix
            }
        })

        return { rawToken, tokenId: token.id }
    }

    private async deleteSandboxApiToken(tokenId: string): Promise<void> {
        await db().api_tokens.delete({
            where: { id: tokenId }
        })
    }

    private async cleanupStaleSandboxTokens(organizationId: string): Promise<void> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        const deleted = await db().api_tokens.deleteMany({
            where: {
                organization_id: organizationId,
                name: "sdk-sandbox-runner",
                created_at: { lt: oneHourAgo }
            }
        })

        if (deleted.count > 0) {
            logger.info("Cleaned up stale sandbox API tokens", { count: deleted.count, organizationId })
        }
    }
}
