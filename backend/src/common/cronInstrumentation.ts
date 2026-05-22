import { captureException } from "./errorCapture"
import logger from "./logger"
import { extractErrorMessage } from "./strings"

export type PlatformCronName = "refresh-tokens" | "scrub-pii" | "cleanup-sdk-images" | "clear-old-secret-versions" | "review-agents"

export function cronStarted(jobName: PlatformCronName): { startedAt: number } {
    const startedAt = Date.now()
    logger.info("cron_job_started", { event: "cron_job_started", jobName })
    return { startedAt }
}

export function cronCompleted(jobName: PlatformCronName, startedAt: number, summary?: Record<string, unknown>): void {
    logger.info("cron_job_completed", {
        event: "cron_job_completed",
        jobName,
        durationMs: Date.now() - startedAt,
        ...(summary && { summary })
    })
}

export function cronFailed(jobName: PlatformCronName, startedAt: number, error: unknown): void {
    logger.error("cron_job_failed", {
        event: "cron_job_failed",
        jobName,
        durationMs: Date.now() - startedAt,
        error: extractErrorMessage(error)
    })
    captureException(error, { source: "platform_cron", jobName })
}
