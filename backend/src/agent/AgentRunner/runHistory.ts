import { RunToolApprovalItem } from "@openai/agents"
import { Prisma } from "@prisma/client"
import { pendingApprovalsKey, serializedEventSchema } from "terse-types"
import { type RunHistoryAction, RunHistoryStatus, type RunHistoryTrigger, type SerializedEvent } from "terse-types"
import { type SkillConfigData, skillConfigDataSchema } from "terse-types/Configs"

import logger from "../../logger"
import { db } from "../../prismaClient"
import { emitCacheInvalidationWithKey } from "../../services/CacheInvalidationService"
import { convertIntegrationTypeToPrismaIntegrationTypeForRunHistory } from "../../utility/typeConverters"
import { CancelReason } from "../cancellation/RunCancellationTaskQueue"

export type RunTrigger = RunHistoryTrigger

export type CompletedRunStatus = typeof RunHistoryStatus.SUCCESS | typeof RunHistoryStatus.FAILED
const PENDING_APPROVALS_INVALIDATION_KEY = pendingApprovalsKey()[0]

export async function createRunRecord(params: { agentId: string; trigger: RunTrigger; serializedTriggerEvent?: SerializedEvent; isManuallyTriggered?: boolean }): Promise<string> {
    const { agentId, trigger, serializedTriggerEvent, isManuallyTriggered } = params
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
            filtered: false,
            decision_action: "processed", // placeholder until we decide after filtering
            decision_reason: "",
            status: RunHistoryStatus.IN_PROGRESS
        },
        select: { id: true }
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
}

export async function appendRunAction(runId: string, action: RunHistoryAction, stepId?: string): Promise<string> {
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

export async function markRunProcessed(runId: string, reason?: string): Promise<void> {
    const prisma = db()
    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            filtered: false,
            decision_action: "processed",
            decision_reason: reason ?? ""
        }
    })
}

export async function finalizeRunStatus(runId: string, status: CompletedRunStatus): Promise<void> {
    const prisma = db()
    const updated = await prisma.run_history_records.update({
        where: { id: runId },
        data: { status },
        select: { automation_id: true }
    })
    if (status === RunHistoryStatus.SUCCESS) {
        try {
            await prisma.automations.update({
                where: { id: updated.automation_id },
                data: { consecutive_failures: 0 }
            })
        } catch (error) {
            logger.warn("Failed to reset consecutive_failures on success", { error, runId, agentId: updated.automation_id })
        }
    }
}

export type FailureTier = "first" | "warning" | "paused"
export const PAUSE_THRESHOLD = 3

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
            select: { consecutive_failures: true, is_active: true }
        })

        const count = updated.consecutive_failures
        let wasPaused = false

        if (count >= PAUSE_THRESHOLD && updated.is_active) {
            await tx.automations.update({
                where: { id: agentId },
                data: { is_active: false }
            })
            wasPaused = true
        }

        const tier: FailureTier = count >= PAUSE_THRESHOLD ? "paused" : count === PAUSE_THRESHOLD - 1 ? "warning" : "first"
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
}

export async function storePendingApprovalState(runId: string, serializedState: string, interruptions: RunToolApprovalItem[]): Promise<void> {
    const prisma = db()

    // Get user_id from run_history_record via automation
    const runRecord = await prisma.run_history_records.findUnique({
        where: { id: runId },
        include: {
            automation: {
                select: {
                    user_id: true,
                    organization_id: true
                }
            }
        }
    })

    if (!runRecord || !runRecord.automation) {
        throw new Error(`Run record not found or automation not found for runId: ${runId}`)
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
            usersId: runRecord.automation.user_id,
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

export async function clearPendingApprovalState(runId: string): Promise<void> {
    const prisma = db()

    const runRecord = await prisma.run_history_records.findUnique({
        where: { id: runId },
        select: {
            automation: {
                select: {
                    organization_id: true
                }
            }
        }
    })

    // Delete the pending approval record
    await prisma.pending_approvals.deleteMany({
        where: { run_history_record_id: runId }
    })

    if (runRecord?.automation.organization_id) {
        emitCacheInvalidationWithKey(runRecord.automation.organization_id, PENDING_APPROVALS_INVALIDATION_KEY)
    }
}

/**
 * Appends SDK skill configs to a run record. Multiple calls within the same
 * job execution are unioned — every config is kept so the correction agent
 * can access everything the original job had.
 */
export async function upsertSdkSkills(runId: string, incoming: SkillConfigData[]): Promise<void> {
    if (incoming.length === 0) return
    const prisma = db()
    const record = await prisma.run_history_records.findUnique({
        where: { id: runId },
        select: { sdk_skills: true }
    })
    const existing = readSdkSkillsFromJson(record?.sdk_skills)
    const merged = [...existing, ...incoming]
    await prisma.run_history_records.update({
        where: { id: runId },
        data: { sdk_skills: merged as unknown as Prisma.InputJsonValue }
    })
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
