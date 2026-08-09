import { db } from "../loaders/prisma"

import { AnalyticsEvent, SandboxRuntimeLatencyProperties, analytics } from "./analytics"
import logger from "./logger"
import { extractErrorMessage } from "./strings"

type DurationKey = Extract<
    keyof SandboxRuntimeLatencyProperties,
    | "queueWaitMs"
    | "resumeSchedulerLagMs"
    | "totalWorkerExecutionMs"
    | "resolveSourceImageMs"
    | "createSandboxTokenMs"
    | "fetchProjectSecretsMs"
    | "createSourceImageSandboxMs"
    | "sandboxAppReadyMs"
    | "sourceImageLoadMs"
    | "sandboxReadyMs"
    | "restoreSnapshotMs"
    | "runtimeCommandMs"
    | "resolveRunStatusMs"
    | "readRunJournalMs"
    | "snapshotRunJournalMs"
    | "terminateRunSandboxMs"
>

type SandboxRuntimeTelemetryParams = {
    userId: string
    organizationId: string
    runId: string
    jobId: string
    projectId: string
    jobName: string
    mode: "fresh" | "resume"
    provider: "containerized" | "local"
    enqueuedAtMs?: number
    scheduledForMs?: number
}

abstract class SandboxTelemetry<TDurationKey extends string> {
    private readonly startedAt = performance.now()

    protected readonly durations: Partial<Record<TDurationKey, number>> = {}

    setDuration(key: TDurationKey, durationMs: number): void {
        if (Number.isFinite(durationMs)) {
            this.durations[key] = Math.max(0, Math.round(durationMs))
        }
    }

    async measure<T>(key: TDurationKey, fn: () => Promise<T>): Promise<T> {
        const start = performance.now()
        try {
            return await fn()
        } finally {
            this.setDuration(key, performance.now() - start)
        }
    }

    protected elapsedSinceStartMs(): number {
        return performance.now() - this.startedAt
    }

    abstract capture(success: boolean, error?: unknown): void | Promise<void>
}

export class SandboxRuntimeTelemetry extends SandboxTelemetry<DurationKey> {
    private runtime: string | undefined

    constructor(private readonly params: SandboxRuntimeTelemetryParams) {
        super()
        if (params.enqueuedAtMs && !params.scheduledForMs) {
            this.setDuration("queueWaitMs", Date.now() - params.enqueuedAtMs)
        }
        if (params.scheduledForMs) {
            this.setDuration("resumeSchedulerLagMs", Date.now() - params.scheduledForMs)
        }
    }

    setRuntime(runtime: string): void {
        this.runtime = runtime
    }

    capture(success: boolean, error?: unknown): void {
        this.setDuration("totalWorkerExecutionMs", this.elapsedSinceStartMs())

        const properties: SandboxRuntimeLatencyProperties = {
            organizationId: this.params.organizationId,
            runId: this.params.runId,
            jobId: this.params.jobId,
            projectId: this.params.projectId,
            jobName: this.params.jobName,
            mode: this.params.mode,
            provider: this.params.provider,
            success,
            runtime: this.runtime,
            ...(error ? { errorMessage: extractErrorMessage(error).slice(0, 500) } : {}),
            ...this.durations
        }

        analytics.capture(this.params.userId, AnalyticsEvent.SANDBOX_RUNTIME_LATENCY, properties)
        logger.info("SDK sandbox: runtime latency captured", properties)
    }
}

type SandboxSuspendDurationKey = "snapshotRunJournalMs" | "markRunSuspendedMs" | "enqueueRunResumptionMs" | "totalSuspendMs"

type SandboxSuspendTelemetryParams = {
    userId: string
    runId: string
    suspensionKind: "timer" | "input"
    delaySeconds?: number
}

export class SandboxSuspendTelemetry extends SandboxTelemetry<SandboxSuspendDurationKey> {
    constructor(private readonly params: SandboxSuspendTelemetryParams) {
        super()
    }

    async capture(success: boolean, error?: unknown): Promise<void> {
        this.setDuration("totalSuspendMs", this.elapsedSinceStartMs())

        try {
            const run = await db().run_history_records.findUnique({
                where: { id: this.params.runId },
                select: { automation: { select: { id: true, organization_id: true, project_id: true } } }
            })

            analytics.capture(this.params.userId, AnalyticsEvent.SANDBOX_SUSPEND_LATENCY, {
                organizationId: run?.automation?.organization_id,
                runId: this.params.runId,
                jobId: run?.automation?.id,
                projectId: run?.automation?.project_id,
                suspensionKind: this.params.suspensionKind,
                delaySeconds: this.params.delaySeconds,
                success,
                ...(error ? { errorMessage: extractErrorMessage(error).slice(0, 500) } : {}),
                ...this.durations
            })
        } catch (captureError) {
            logger.warn("Failed to capture sandbox suspend latency", { runId: this.params.runId, error: captureError })
        }
    }
}
