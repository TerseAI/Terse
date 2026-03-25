import crypto from "crypto"
import { unzipSync } from "fflate"
import { ModalClient, Sandbox } from "modal"

import { finalizeRunStatus, markRunFailed } from "../agent/AgentRunner/runHistory"
import { settings } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { RunHistoryStatus } from "../shared/RunHistoryTypes"

import { downloadSdkDeployZip } from "./FileStorageService"
import { sdkRuntimeExecutorRegistry } from "./sdkRuntimeExecutors/SdkRuntimeExecutorRegistry"
import { SDK_SANDBOX_CODE_ZIP_PATH, SDK_SANDBOX_EVENT_FILE_PATH, SDK_SANDBOX_PROJECT_DIR, type SandboxCommandResult, type SdkRuntimeExecutorContext } from "./sdkRuntimeExecutors/types"

export interface SdkJobExecutionParams {
    gcsKey: string
    runId: string
    agentId: string
    orgId: string
    userId: string
    eventJson: string
    jobName: string
}

export class SdkJobExecutionService {
    private elapsed(startMs: number): string {
        return `${((performance.now() - startMs) / 1000).toFixed(2)}s`
    }

    async execute(params: SdkJobExecutionParams): Promise<void> {
        const { gcsKey, runId, agentId, orgId, userId, eventJson, jobName } = params
        const executionStart = performance.now()

        let sandboxApiKey: string | undefined
        let sandboxTokenId: string | undefined

        try {
            // 1. Download zip from GCS
            let t = performance.now()
            const zipBuffer = await downloadSdkDeployZip(gcsKey)
            if (!zipBuffer) {
                await markRunFailed(runId, "Failed to download SDK deploy zip from GCS", "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                return
            }
            logger.info("SDK sandbox: downloaded zip from GCS", { runId, agentId, duration: this.elapsed(t), sizeBytes: zipBuffer.length })

            const archiveEntries = new Set(Object.keys(unzipSync(new Uint8Array(zipBuffer))))
            const executor = sdkRuntimeExecutorRegistry.resolve(archiveEntries)
            logger.info("SDK sandbox: detected project runtime", { runId, agentId, runtime: executor.runtime })

            // 2. Generate a temporary API key for the sandbox
            t = performance.now()
            const { rawToken, tokenId } = await this.createSandboxApiToken(userId, orgId)
            sandboxApiKey = rawToken
            sandboxTokenId = tokenId
            logger.info("SDK sandbox: created temp API token", { runId, agentId, duration: this.elapsed(t) })

            // 3. Clean up stale sandbox tokens (older than 1 hour) as safety net
            void this.cleanupStaleSandboxTokens(orgId).catch(err => {
                logger.warn("Failed to cleanup stale sandbox tokens", { error: err })
            })

            // 4. Create Modal sandbox
            const backendUrl = settings.urls.backend ?? "http://localhost:3001"

            const modal = new ModalClient({
                tokenId: settings.modal.tokenId,
                tokenSecret: settings.modal.tokenSecret
            })

            t = performance.now()
            const app = await modal.apps.fromName("terse-sdk-sandbox", { createIfMissing: true })
            const image = modal.images.fromRegistry(executor.sandboxImage)
            const sb = await modal.sandboxes.create(app, image, { timeoutMs: 5 * 60 * 1000 })
            logger.info("SDK sandbox: created Modal sandbox", {
                runId,
                agentId,
                sandboxId: sb.sandboxId,
                runtime: executor.runtime,
                image: executor.sandboxImage,
                duration: this.elapsed(t)
            })

            const sandboxEnv = {
                TERSE_API_KEY: sandboxApiKey,
                TERSE_BACKEND_URL: backendUrl,
                TERSE_RUN_ID: runId
            }

            try {
                const executorContext = this.createRuntimeExecutorContext(sb, sandboxEnv, runId, agentId, jobName)
                await this.uploadZipToSandbox(sb, zipBuffer, runId, agentId)
                await this.unzipProjectInSandbox(executorContext)
                await this.writeEventFile(sb, eventJson)
                const result = await executor.execute(executorContext)

                if (result.exitCode === 0) {
                    await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
                    logger.info("SDK sandbox: terse run completed", { runId, agentId, runtime: executor.runtime })
                } else {
                    throw new Error(this.buildFailureMessage("terse run", result))
                }

                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                await sb.terminate()

                logger.info("SDK sandbox: total execution finished", { runId, agentId, runtime: executor.runtime, totalDuration: this.elapsed(executionStart) })
            } catch (sandboxError) {
                await sb.terminate().catch(() => {})
                throw sandboxError
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            logger.error("SDK job execution failed", { error, runId, agentId, totalDuration: this.elapsed(executionStart) })

            try {
                await markRunFailed(runId, errorMessage, "agent")
                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
            } catch (e) {
                logger.error("Failed to mark run as failed after SDK execution error", { error: e, runId })
            }
        } finally {
            // Cleanup: delete the temporary API token
            if (sandboxTokenId) {
                await this.deleteSandboxApiToken(sandboxTokenId).catch(err => {
                    logger.warn("Failed to delete sandbox API token", { error: err, tokenId: sandboxTokenId })
                })
            }
        }
    }

    private async uploadZipToSandbox(sb: Sandbox, zipBuffer: Buffer, runId: string, agentId: string): Promise<void> {
        const t = performance.now()
        const writeHandle = await sb.open(SDK_SANDBOX_CODE_ZIP_PATH, "w")
        await writeHandle.write(new Uint8Array(zipBuffer))
        await writeHandle.close()
        logger.info("SDK sandbox: uploaded zip to sandbox", { runId, agentId, duration: this.elapsed(t) })
    }

    private async unzipProjectInSandbox(context: SdkRuntimeExecutorContext): Promise<void> {
        await context.ensureSandboxCommand(
            "install unzip and extract project",
            `export DEBIAN_FRONTEND=noninteractive && apt-get update -qq && apt-get install -y -qq unzip && unzip -o ${SDK_SANDBOX_CODE_ZIP_PATH} -d ${SDK_SANDBOX_PROJECT_DIR}`
        )
    }

    private async writeEventFile(sb: Sandbox, eventJson: string): Promise<void> {
        const eventHandle = await sb.open(SDK_SANDBOX_EVENT_FILE_PATH, "w")
        await eventHandle.write(new TextEncoder().encode(eventJson))
        await eventHandle.close()
    }

    private createRuntimeExecutorContext(sb: Sandbox, sandboxEnv: Record<string, string>, runId: string, agentId: string, jobName: string): SdkRuntimeExecutorContext {
        return {
            sb,
            sandboxEnv,
            runId,
            agentId,
            jobName,
            projectDir: SDK_SANDBOX_PROJECT_DIR,
            eventFilePath: SDK_SANDBOX_EVENT_FILE_PATH,
            ensureSandboxCommand: async (label, command) => {
                await this.ensureSandboxCommand(sb, label, command, sandboxEnv, runId, agentId)
            },
            runSandboxCommand: async (label, command) => {
                return this.runSandboxCommand(sb, label, command, sandboxEnv, runId, agentId)
            },
            escapeShellArg: value => this.escapeShellArg(value)
        }
    }

    private async ensureSandboxCommand(sb: Sandbox, label: string, command: string, sandboxEnv: Record<string, string>, runId: string, agentId: string): Promise<void> {
        const result = await this.runSandboxCommand(sb, label, command, sandboxEnv, runId, agentId)
        if (result.exitCode !== 0) {
            throw new Error(this.buildFailureMessage(label, result))
        }
    }

    private async runSandboxCommand(sb: Sandbox, label: string, command: string, sandboxEnv: Record<string, string>, runId: string, agentId: string): Promise<SandboxCommandResult> {
        const t = performance.now()
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
            duration: this.elapsed(t),
            exitCode,
            stdout: this.clipOutput(stdout),
            stderr: this.clipOutput(stderr)
        })

        return { exitCode, stdout, stderr }
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
