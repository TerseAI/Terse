import { RunToolApprovalItem } from "@openai/agents"
import { Prisma } from "@prisma/client"
import { pendingApprovalsKey, serializedEventSchema } from "terse-types"
import { type RunHistoryAction, RunHistoryStatus, type RunHistoryTrigger, type SerializedEvent } from "terse-types"
import { type SkillConfigData, skillConfigDataSchema } from "terse-types/Configs"
import type { ExecutionRegion } from "terse-types/ExecutionRegions"

import { AnalyticsEvent, RunEventProperties, analytics } from "../../../common/analytics"
import logger from "../../../common/logger"
import { convertIntegrationTypeToPrismaIntegrationTypeForRunHistory } from "../../../common/typeConverters"
import { db } from "../../../loaders/prisma"
import { emitCacheInvalidationWithKey, emitCacheInvalidationWithWildcard } from "../../../services/CacheInvalidationService"
import { CancelReason } from "../cancellation/RunCancellationTaskQueue"

export type RunTrigger = RunHistoryTrigger

export type CompletedRunStatus = typeof RunHistoryStatus.SUCCESS | typeof RunHistoryStatus.FAILED
const PENDING_APPROVALS_INVALIDATION_KEY = pendingApprovalsKey()[0]

export async function createRunRecord(params: {
    agentId: string
    trigger: RunTrigger
    serializedTriggerEvent?: SerializedEvent
    isManuallyTriggered?: boolean
    isTest?: boolean
    triggeredByUserId?: string
    replayOfRunId?: string
    executionRegion: ExecutionRegion | null
}): Promise<string> {
    const { agentId, trigger, serializedTriggerEvent, isManuallyTriggered, isTest, triggeredByUserId, replayOfRunId, executionRegion } = params
    const prisma = db()
    const record = await prisma.run_history_records.create({
        data: {
            automation_id: agentId, // Database column is still automation_id
            event: trigger.event,
            trigger_integration: convertIntegrationTypeToPrismaIntegrationTypeForRunHistory(trigger.integration),
            trigger_source: trigger.source,
            trigger_title: trigger.title ?? null,
            trigger_subheader: trigger.subheader ?? null,
            trigger_url: trigger.url ?? null,
            trigger_payload: serializedTriggerEvent ? JSON.stringify(serializedTriggerEvent as Prisma.InputJsonValue) : Prisma.DbNull,
            is_manually_triggered: isManuallyTriggered ?? false,
            is_test: isTest ?? false,
            triggered_by_user_id: triggeredByUserId ?? null,
            replay_of_run_id: replayOfRunId ?? null,
            execution_region: executionRegion,
            filtered: false,
            decision_action: "processed", // placeholder until we decide after filtering
            decision_reason: "",
            status: RunHistoryStatus.IN_PROGRESS
        },
        select: { id: true, automation: { select: { id: true, name: true, user_id: true, organization_id: true } } }
    })

    analytics.capture(triggeredByUserId ?? record.automation.user_id, AnalyticsEvent.JOB_TRIGGERED, {
        runId: record.id,
        jobId: record.automation.id,
        jobName: record.automation.name,
        organizationId: record.automation.organization_id ?? undefined,
        triggerIntegration: trigger.integration,
        triggerEvent: trigger.event,
        isManuallyTriggered: isManuallyTriggered ?? false,
        isTest: isTest ?? false,
        isReplay: !!replayOfRunId,
        executionRegion
    })

    return record.id
}

export async function markRunSkipped(runId: string, reason: string): Promise<void> {
    const prisma = db()
    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            filtered: true,
            decision_action: "skipped",
            decision_reason: reason,
            status: RunHistoryStatus.SKIPPED
        }
    })
    captureRunLifecycleEvent(runId, AnalyticsEvent.JOB_SKIPPED, { reason })
}

export async function appendRunAction(runId: string, action: RunHistoryAction, organizationId: string, stepId?: string): Promise<string> {
    const owned = await db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: organizationId } },
        select: { id: true }
    })
    if (!owned) {
        throw new Error(`appendRunAction: run ${runId} not found in organization ${organizationId}`)
    }
    const result = await db().run_history_actions.create({
        data: {
            run_history_record_id: runId,
            action: action.action,
            integration: convertIntegrationTypeToPrismaIntegrationTypeForRunHistory(action.integration),
            target: action.target,
            details: action.details,
            url: action.url ?? null,
            step_id: stepId ?? action.step_id ?? null,
            type: action.type,
            is_read_only: action.isReadOnly ?? true
        }
    })

    return result.id
}

export async function finalizeRunStatus(runId: string, status: CompletedRunStatus): Promise<void> {
    const prisma = db()
    // A suspended run exited cleanly to park itself; a clean process exit must not
    // be mistaken for completion and overwrite the suspended state.
    const result = await prisma.run_history_records.updateMany({
        where: { id: runId, status: { not: RunHistoryStatus.SUSPENDED } },
        data: { status }
    })
    if (result.count === 0) return
    captureRunLifecycleEvent(runId, status === RunHistoryStatus.SUCCESS ? AnalyticsEvent.JOB_COMPLETED : AnalyticsEvent.JOB_FAILED)
    if (status === RunHistoryStatus.SUCCESS) {
        const record = await prisma.run_history_records.findUnique({
            where: { id: runId },
            select: { automation_id: true }
        })
        if (record) {
            try {
                await prisma.automations.update({
                    where: { id: record.automation_id },
                    data: { consecutive_failures: 0 }
                })
            } catch (error) {
                logger.warn("Failed to reset consecutive_failures on success", { error, runId, agentId: record.automation_id })
            }
        }
    }
}

type FailureTier = "first" | "warning" | "paused"
const PAUSE_THRESHOLD = 3

export type FailureState = {
    consecutiveFailures: number
    tier: FailureTier
    wasPaused: boolean
}

// Atomically increments the agent's consecutive_failures counter and auto-pauses
// the agent (is_active = false) when it crosses PAUSE_THRESHOLD. The atomic
// increment is important: parallel failures could otherwise both observe a
// pre-threshold value and skip the pause.
export async function recordAgentFailureAndMaybePause(agentId: string): Promise<FailureState> {
    const prisma = db()
    return await prisma.$transaction(async tx => {
        const updated = await tx.automations.update({
            where: { id: agentId },
            data: { consecutive_failures: { increment: 1 } },
            select: { consecutive_failures: true, is_active: true, user_id: true, organization_id: true }
        })

        const count = updated.consecutive_failures
        let wasPaused = false

        if (count >= PAUSE_THRESHOLD && updated.is_active) {
            await tx.automations.update({
                where: { id: agentId },
                data: { is_active: false }
            })
            wasPaused = true
            analytics.capture(updated.user_id, AnalyticsEvent.JOB_AUTO_PAUSED, {
                jobId: agentId,
                organizationId: updated.organization_id ?? undefined,
                consecutiveFailures: count
            })
        }
        let tier: FailureTier
        if (count >= PAUSE_THRESHOLD) {
            tier = "paused"
        } else if (count === PAUSE_THRESHOLD - 1) {
            tier = "warning"
        } else {
            tier = "first"
        }
        return { consecutiveFailures: count, tier, wasPaused }
    })
}

export async function attachProjectDeployToRun(runId: string, projectDeployId: string): Promise<void> {
    const prisma = db()
    await prisma.run_history_records.update({
        where: { id: runId },
        data: { project_deploy_id: projectDeployId }
    })
}

export type CompletedRunEvaluation = { status: typeof RunHistoryStatus.SUCCESS; isSuccessful: true } | { status: typeof RunHistoryStatus.FAILED; isSuccessful: false; failureReason: string }

export function evaluateCompletedRun(finalOutput: unknown, endedWithToolFailure: boolean): CompletedRunEvaluation {
    const hasFinalOutput = Boolean(finalOutput)
    if (endedWithToolFailure) {
        return {
            status: RunHistoryStatus.FAILED,
            isSuccessful: false,
            failureReason: "The run ended after a failed tool call."
        }
    }

    if (!hasFinalOutput) {
        return {
            status: RunHistoryStatus.FAILED,
            isSuccessful: false,
            failureReason: "The run completed without a final output."
        }
    }

    return {
        status: RunHistoryStatus.SUCCESS,
        isSuccessful: true
    }
}

export async function markRunInProgress(runId: string): Promise<void> {
    const prisma = db()
    await prisma.run_history_records.update({
        where: { id: runId },
        data: { status: RunHistoryStatus.IN_PROGRESS }
    })
}

export type RunSuspensionDetails = { kind: "input"; hookToken?: string } | { kind: "timer"; delaySeconds: number }

export async function markRunSuspended(runId: string, suspendImageId: string, details: RunSuspensionDetails): Promise<boolean> {
    const suspended = await db().$transaction(async tx => {
        const result = await tx.run_history_records.updateMany({
            where: { id: runId, status: RunHistoryStatus.IN_PROGRESS },
            data: { status: RunHistoryStatus.SUSPENDED }
        })
        if (result.count === 0) return false
        await tx.run_suspensions.create({
            data: {
                run_id: runId,
                kind: details.kind,
                suspend_image_id: suspendImageId,
                hook_token: details.kind === "input" ? (details.hookToken ?? null) : null,
                delay_seconds: details.kind === "timer" ? details.delaySeconds : null
            }
        })
        return true
    })
    if (suspended) {
        captureRunLifecycleEvent(runId, AnalyticsEvent.JOB_SUSPENDED, { suspensionKind: details.kind })
        await emitRunHistoryInvalidation(runId)
    }
    return suspended
}

export type SuspendedRunClaim = { claimed: false } | { claimed: true; suspendImageId?: string }

// Atomically claims a suspended run for resumption. Only the caller that flips
// suspended -> in_progress wins, which guarantees a single live sandbox per run
// when a timer and another resume race. Stamps the open suspension row and returns
// its snapshot image.
export async function claimSuspendedRun(runId: string): Promise<SuspendedRunClaim> {
    const claim = await db().$transaction(async (tx): Promise<SuspendedRunClaim> => {
        const result = await tx.run_history_records.updateMany({
            where: { id: runId, status: RunHistoryStatus.SUSPENDED },
            data: { status: RunHistoryStatus.IN_PROGRESS }
        })
        if (result.count === 0) return { claimed: false }

        const suspension = await tx.run_suspensions.findFirst({
            where: { run_id: runId, resumed_at: null },
            orderBy: { created_at: "desc" }
        })
        if (!suspension) return { claimed: true }

        await tx.run_suspensions.update({ where: { id: suspension.id }, data: { resumed_at: new Date() } })
        return { claimed: true, suspendImageId: suspension.suspend_image_id }
    })
    if (claim.claimed) {
        captureRunLifecycleEvent(runId, AnalyticsEvent.JOB_RESUMED)
        await emitRunHistoryInvalidation(runId)
    }
    return claim
}

export type FailedRunSnapshotClaim = { claimed: false } | { claimed: true; snapshotImageId: string }

// Claims a specific failure snapshot and moves the same run back into progress. Keeping
// the claim in the worker avoids leaving the run in progress if enqueueing succeeds but
// the worker is delayed, and prevents two clicks from restoring the same attempt twice.
export async function claimFailedRunSnapshot(runId: string, failureSnapshotId: string): Promise<FailedRunSnapshotClaim> {
    const claim = await db().$transaction(async (tx): Promise<FailedRunSnapshotClaim> => {
        const snapshot = await tx.run_failure_snapshots.findFirst({
            where: { id: failureSnapshotId, run_id: runId, restored_at: null },
            select: { snapshot_image_id: true }
        })
        if (!snapshot) return { claimed: false }

        const run = await tx.run_history_records.updateMany({
            where: { id: runId, status: RunHistoryStatus.FAILED },
            data: { status: RunHistoryStatus.IN_PROGRESS }
        })
        if (run.count === 0) return { claimed: false }

        const restored = await tx.run_failure_snapshots.updateMany({
            where: { id: failureSnapshotId, run_id: runId, restored_at: null },
            data: { restored_at: new Date() }
        })
        if (restored.count === 0) throw new Error(`Failure snapshot ${failureSnapshotId} was claimed concurrently`)

        return { claimed: true, snapshotImageId: snapshot.snapshot_image_id }
    })
    if (claim.claimed) {
        captureRunLifecycleEvent(runId, AnalyticsEvent.JOB_RESUMED)
        await emitRunHistoryInvalidation(runId)
    }
    return claim
}

async function emitRunHistoryInvalidation(runId: string): Promise<void> {
    const run = await db().run_history_records.findUnique({
        where: { id: runId },
        select: { automation_id: true, automation: { select: { organization_id: true } } }
    })
    if (run?.automation?.organization_id) {
        emitCacheInvalidationWithWildcard(run.automation.organization_id, "runHistory", run.automation_id)
        emitCacheInvalidationWithWildcard(run.automation.organization_id, "chatHistory", runId)
    }
}

export type FailureStage = "filter" | "agent"

export async function markRunFailed(runId: string, errorMessage: string, stage?: FailureStage): Promise<boolean> {
    const prisma = db()

    // Prefix error message with failure stage for easy identification
    const prefixedMessage = stage ? `[${stage.toUpperCase()}_ERROR] ${errorMessage}` : errorMessage

    const result = await prisma.run_history_records.updateMany({
        where: {
            id: runId,
            status: { in: [RunHistoryStatus.IN_PROGRESS, RunHistoryStatus.AWAITING_APPROVAL] }
        },
        data: {
            status: RunHistoryStatus.FAILED,
            decision_action: "processed",
            decision_reason: prefixedMessage
        }
    })
    if (result.count > 0) captureRunLifecycleEvent(runId, AnalyticsEvent.JOB_FAILED, { errorMessage, failureStage: stage })
    return result.count > 0
}

export async function markRunCancelled(runId: string, reason: string = CancelReason.USER_CANCELLED): Promise<void> {
    const prisma = db()
    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            status: RunHistoryStatus.CANCELLED,
            decision_action: "processed",
            decision_reason: reason
        }
    })
    captureRunLifecycleEvent(runId, AnalyticsEvent.JOB_CANCELLED, { reason })
}

export async function storePendingApprovalState(runId: string, organizationId: string, serializedState: string, interruptions: RunToolApprovalItem[]): Promise<void> {
    const prisma = db()

    const runRecord = await prisma.run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: organizationId } },
        include: {
            automation: {
                select: {
                    id: true,
                    name: true,
                    user_id: true,
                    organization_id: true
                }
            }
        }
    })

    if (!runRecord || !runRecord.automation) {
        throw new Error(`storePendingApprovalState: run ${runId} not found in organization ${organizationId}`)
    }

    // Upsert pending approval record (create or update if exists)
    await prisma.pending_approvals.upsert({
        where: { run_history_record_id: runId },
        update: {
            serialized_state: serializedState,
            interruptions: interruptions as Prisma.InputJsonValue,
            updated_at: new Date()
        },
        create: {
            run_history_record_id: runId,
            serialized_state: serializedState,
            interruptions: interruptions as Prisma.InputJsonValue
        }
    })

    // Update run status to awaiting_approval and mark as having an approval request
    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            status: RunHistoryStatus.AWAITING_APPROVAL,
            has_approval_request: true
        }
    })

    analytics.capture(runRecord.automation.user_id, AnalyticsEvent.JOB_AWAITING_APPROVAL, {
        runId,
        jobId: runRecord.automation.id,
        jobName: runRecord.automation.name,
        organizationId: runRecord.automation.organization_id ?? undefined
    })

    if (runRecord.automation.organization_id) {
        emitCacheInvalidationWithKey(runRecord.automation.organization_id, PENDING_APPROVALS_INVALIDATION_KEY)
    }
}

export async function getPendingApprovalState(runId: string): Promise<{
    serializedState: string
    interruptions: RunToolApprovalItem[]
} | null> {
    const prisma = db()
    const pendingApproval = await prisma.pending_approvals.findUnique({
        where: { run_history_record_id: runId },
        select: {
            serialized_state: true,
            interruptions: true
        }
    })

    if (!pendingApproval) {
        return null
    }

    // serialized_state is stored as a string (Text field)
    const serializedState = pendingApproval.serialized_state

    // Type guard: validate interruptions array structure
    // Note: We store these as JSON, so we need to cast from Prisma.JsonValue
    const interruptionsValue = pendingApproval.interruptions
    const interruptions: RunToolApprovalItem[] = Array.isArray(interruptionsValue) ? (interruptionsValue as unknown as RunToolApprovalItem[]) : []

    return {
        serializedState,
        interruptions
    }
}

export async function clearPendingApprovalState(runId: string, organizationId: string): Promise<void> {
    const prisma = db()

    const runRecord = await prisma.run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: organizationId } },
        select: {
            automation: {
                select: {
                    organization_id: true
                }
            }
        }
    })
    if (!runRecord) {
        return
    }

    await prisma.pending_approvals.deleteMany({
        where: { run_history_record_id: runId }
    })

    if (runRecord.automation.organization_id) {
        emitCacheInvalidationWithKey(runRecord.automation.organization_id, PENDING_APPROVALS_INVALIDATION_KEY)
    }
}

/**
 * Appends SDK skill configs to a run record. Multiple calls within the same
 * job execution are unioned — every config is kept so the correction agent
 * can access everything the original job had.
 */
export async function upsertSdkSkills(runId: string, organizationId: string, incoming: SkillConfigData[]): Promise<void> {
    if (incoming.length === 0) return
    const prisma = db()
    await prisma.$executeRaw`
        UPDATE run_history_records rhr
        SET sdk_skills = COALESCE(rhr.sdk_skills, '[]'::jsonb) || ${JSON.stringify(incoming)}::jsonb
        FROM automations a
        WHERE rhr.id = ${runId}
          AND a.id = rhr.automation_id
          AND a.organization_id = ${organizationId}
    `
}

/**
 * Reads and parses the SDK skills stored on a run record.
 * Returns an empty array if nothing is stored or parsing fails.
 */
export function readSdkSkillsFromJson(sdkSkillsJson: unknown): SkillConfigData[] {
    if (!sdkSkillsJson) return []
    try {
        return skillConfigDataSchema.array().parse(sdkSkillsJson)
    } catch (error) {
        logger.warn("Failed to parse sdk_skills from run record", { error })
        return []
    }
}

type RunLifecycleEvent =
    | typeof AnalyticsEvent.JOB_SKIPPED
    | typeof AnalyticsEvent.JOB_COMPLETED
    | typeof AnalyticsEvent.JOB_FAILED
    | typeof AnalyticsEvent.JOB_SUSPENDED
    | typeof AnalyticsEvent.JOB_RESUMED
    | typeof AnalyticsEvent.JOB_CANCELLED

// Fire-and-forget: run status transitions must never fail on analytics. Events are
// attributed to the job's owner and grouped under the organization.
function captureRunLifecycleEvent(runId: string, event: RunLifecycleEvent, extra?: Partial<RunEventProperties>): void {
    void db()
        .run_history_records.findUnique({
            where: { id: runId },
            select: { automation: { select: { id: true, name: true, user_id: true, organization_id: true } } }
        })
        .then(run => {
            if (!run?.automation) return
            analytics.capture(run.automation.user_id, event, {
                runId,
                jobId: run.automation.id,
                jobName: run.automation.name,
                organizationId: run.automation.organization_id ?? undefined,
                ...extra
            })
        })
        .catch((error: unknown) => logger.warn("Failed to capture run analytics event", { error, runId, event }))
}
