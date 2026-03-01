import { RunToolApprovalItem } from "@openai/agents"
import { Prisma } from "@prisma/client"

import { db } from "../../prismaClient"
import { emitCacheInvalidationWithKey } from "../../services/CacheInvalidationService"
import { pendingApprovalsKey } from "../../shared/InvalidationKeys"
import { type RunHistoryAction, RunHistoryStatus, type RunHistoryTrigger } from "../../shared/RunHistoryTypes"
import { convertIntegrationTypeToPrismaIntegrationTypeForRunHistory } from "../../utility/typeConverters"

export type RunTrigger = RunHistoryTrigger

export type CompletedRunStatus = RunHistoryStatus.SUCCESS | RunHistoryStatus.FAILED
const PENDING_APPROVALS_INVALIDATION_KEY = pendingApprovalsKey()[0]

export async function createRunRecord(params: { agentId: string; trigger: RunTrigger; isManuallyTriggered?: boolean }): Promise<string> {
    const { agentId, trigger, isManuallyTriggered } = params
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
    await prisma.run_history_records.update({
        where: { id: runId },
        data: { status }
    })
}

export type CompletedRunEvaluation = { status: RunHistoryStatus.SUCCESS; isSuccessful: true } | { status: RunHistoryStatus.FAILED; isSuccessful: false; failureReason: string }

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

export async function markRunFailed(runId: string, errorMessage: string, stage?: FailureStage): Promise<void> {
    const prisma = db()

    // Prefix error message with failure stage for easy identification
    const prefixedMessage = stage ? `[${stage.toUpperCase()}_ERROR] ${errorMessage}` : errorMessage

    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            status: RunHistoryStatus.FAILED,
            decision_action: "processed",
            decision_reason: prefixedMessage
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

    // Update run status to awaiting_approval
    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            status: RunHistoryStatus.AWAITING_APPROVAL
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
