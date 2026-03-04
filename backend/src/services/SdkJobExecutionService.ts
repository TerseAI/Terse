import crypto from "crypto"
import { ModalClient } from "modal"

import { finalizeRunStatus, markRunFailed } from "../agent/AgentRunner/runHistory"
import { settings } from "../config/settings"
import logger from "../logger"
import { db } from "../prismaClient"
import { emitCacheInvalidationWithWildcard } from "../realtimeSocket"
import { RunHistoryStatus } from "../shared/RunHistoryTypes"

import { downloadSdkDeployZip } from "./FileStorageService"

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
            const image = modal.images.fromRegistry("node:22-slim")
            const sb = await modal.sandboxes.create(app, image, { timeoutMs: 5 * 60 * 1000 })
            logger.info("SDK sandbox: created Modal sandbox", { runId, agentId, sandboxId: sb.sandboxId, duration: this.elapsed(t) })

            const sandboxEnv = {
                TERSE_API_KEY: sandboxApiKey,
                TERSE_BACKEND_URL: backendUrl,
                TERSE_RUN_ID: runId
            }

            try {
                // Write zip buffer into sandbox filesystem
                t = performance.now()
                const writeHandle = await sb.open("/tmp/code.zip", "w")
                await writeHandle.write(new Uint8Array(zipBuffer))
                await writeHandle.close()
                logger.info("SDK sandbox: uploaded zip to sandbox", { runId, agentId, duration: this.elapsed(t) })

                // Install unzip & extract
                t = performance.now()
                const unzipProc = await sb.exec(["sh", "-c", "apt-get update -qq && apt-get install -y -qq unzip > /dev/null 2>&1 && cd /tmp && unzip -o code.zip -d project > /dev/null"], {
                    stdout: "pipe",
                    stderr: "pipe"
                })
                await unzipProc.wait()
                logger.info("SDK sandbox: unzipped code", { runId, agentId, duration: this.elapsed(t) })

                // npm install
                t = performance.now()
                const installProc = await sb.exec(["sh", "-c", "cd /tmp/project && npm install --omit=dev 2>&1"], { stdout: "pipe", stderr: "pipe", env: sandboxEnv })
                const installStdout = await installProc.stdout.readText()
                const installExitCode = await installProc.wait()
                logger.info("SDK sandbox: npm install", { runId, agentId, duration: this.elapsed(t), exitCode: installExitCode, output: installStdout.slice(0, 500) })

                if (installExitCode !== 0) {
                    const installStderr = await installProc.stderr.readText()
                    await markRunFailed(runId, `npm install failed (exit ${installExitCode}): ${installStderr.slice(0, 500)}`, "agent")
                    emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                    await sb.terminate()
                    return
                }

                // npm install terse-cli
                t = performance.now()
                const installTerseProc = await sb.exec(["sh", "-c", "cd /tmp/project && npm install terse-cli@latest 2>&1"], { stdout: "pipe", stderr: "pipe", env: sandboxEnv })
                const installTerseStdout = await installTerseProc.stdout.readText()
                const installTerseExitCode = await installTerseProc.wait()
                logger.info("SDK sandbox: npm install terse-cli", { runId, agentId, duration: this.elapsed(t), exitCode: installTerseExitCode, output: installTerseStdout.slice(0, 500) })

                if (installTerseExitCode !== 0) {
                    logger.error("SDK sandbox: npm install terse-cli failed", { runId, agentId, exitCode: installTerseExitCode, output: installTerseStdout.slice(0, 500) })
                    const installTerseStderr = await installTerseProc.stderr.readText()
                    await markRunFailed(runId, `npm install terse-cli failed (exit ${installTerseExitCode}): ${installTerseStderr.slice(0, 500)}`, "agent")
                    emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                    await sb.terminate()
                    return
                }

                // terse run
                t = performance.now()
                const escapedJobName = jobName.replace(/'/g, "'\\''")
                const runProc = await sb.exec(["sh", "-c", `cd /tmp/project && npx terse run '${escapedJobName}' --event '${eventJson.replace(/'/g, "'\\''")}'`], {
                    stdout: "pipe",
                    stderr: "pipe",
                    env: sandboxEnv
                })

                const [stdout, stderr] = await Promise.all([runProc.stdout.readText(), runProc.stderr.readText()])
                const exitCode = await runProc.wait()
                const runDuration = this.elapsed(t)

                logger.info("SDK sandbox: terse run", { runId, agentId, duration: runDuration, exitCode, stdout: stdout.slice(0, 2000), stderr: stderr.slice(0, 2000) })

                if (stdout) {
                    logger.info("SDK sandbox: terse run stdout", { runId, agentId, stdout: stdout.slice(0, 2000) })
                }
                if (stderr) {
                    logger.warn("SDK sandbox: terse run stderr", { runId, agentId, stderr: stderr.slice(0, 2000) })
                }

                if (exitCode === 0) {
                    await finalizeRunStatus(runId, RunHistoryStatus.SUCCESS)
                    logger.info("SDK sandbox: terse run completed", { runId, agentId, duration: runDuration })
                } else {
                    const errorMsg = stderr ? stderr.slice(0, 500) : `Process exited with code ${exitCode}`
                    await markRunFailed(runId, errorMsg, "agent")
                    logger.error("SDK sandbox: terse run failed", { runId, agentId, exitCode, duration: runDuration })
                }

                emitCacheInvalidationWithWildcard(orgId, "runHistory", agentId)
                await sb.terminate()

                logger.info("SDK sandbox: total execution finished", { runId, agentId, totalDuration: this.elapsed(executionStart) })
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
