import { RunToolApprovalItem } from "@openai/agents"
import type { RunHistoryChatEventType } from "@prisma/client"
import { Prisma } from "@prisma/client"

import { db } from "../../prismaClient"
import { ModelEvent } from "../../shared/ModelEvents"
import type { RunHistoryAction, RunHistoryStatus, RunHistoryTrigger } from "../../shared/RunHistoryTypes"
import { convertIntegrationTypeToPrismaIntegrationTypeForRunHistory } from "../../utility/typeConverters"

export type RunTrigger = RunHistoryTrigger

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
            status: "in_progress"
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
            status: "skipped"
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

export async function finalizeRunStatus(runId: string, status: Extract<RunHistoryStatus, "success" | "failed">): Promise<void> {
    const prisma = db()
    await prisma.run_history_records.update({
        where: { id: runId },
        data: { status }
    })
}

/**
 * Final run status requires both:
 * - A non-empty final output from the model
 * - No terminal tool-call failure at the end of execution
 */
export function resolveFinalRunStatus(finalOutput: unknown, endedWithToolFailure: boolean): Extract<RunHistoryStatus, "success" | "failed"> {
    const hasFinalOutput = Boolean(finalOutput)
    return hasFinalOutput && !endedWithToolFailure ? "success" : "failed"
}

export async function markRunInProgress(runId: string): Promise<void> {
    const prisma = db()
    await prisma.run_history_records.update({
        where: { id: runId },
        data: { status: "in_progress" }
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
            status: "failed",
            decision_action: "processed",
            decision_reason: prefixedMessage
        }
    })
}

export async function storeChatEvent(runId: string, event: ModelEvent, timestamp?: Date | string): Promise<string> {
    const prisma = db()

    // Use provided timestamp or current time
    const eventTimestamp = timestamp ? (typeof timestamp === "string" ? new Date(timestamp) : timestamp) : new Date()

    // Store the full event as JSON for easy deserialization
    const created = await prisma.run_history_chat_events.create({
        data: {
            run_history_record_id: runId,
            event_type: event.type as RunHistoryChatEventType,
            event_json: event as Prisma.InputJsonValue,
            timestamp: eventTimestamp
        },
        select: { id: true }
    })

    return created.id
}

export async function storePendingApprovalState(runId: string, serializedState: string, interruptions: RunToolApprovalItem[]): Promise<void> {
    const prisma = db()

    // Get user_id from run_history_record via automation
    const runRecord = await prisma.run_history_records.findUnique({
        where: { id: runId },
        include: {
            automation: {
                select: {
                    user_id: true
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
            status: "awaiting_approval"
        }
    })
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
    // Delete the pending approval record
    await prisma.pending_approvals.deleteMany({
        where: { run_history_record_id: runId }
    })
}
