import { db } from "../../prismaClient";
import type { RunHistoryAction, RunHistoryStatus, RunHistoryTrigger } from "../../shared/RunHistoryTypes";
import { convertIntegrationTypeToRunHistoryIntegration } from "../../utility/typeConverters";
import { ModelEvent } from "../../shared/ModelEvents";
import type { RunHistoryChatEventType } from "@prisma/client";

export type RunTrigger = RunHistoryTrigger;

export async function createRunRecord(params: {
    channelId: string;
    trigger: RunTrigger;
}): Promise<string> {
    const { channelId, trigger } = params;
    const prisma = db();
    const record = await prisma.run_history_records.create({
        data: {
            automation_id: channelId, // Database column is still automation_id
            event: trigger.event,
            trigger_integration: convertIntegrationTypeToRunHistoryIntegration(trigger.integration),
            trigger_source: trigger.source,
            trigger_title: trigger.title ?? null,
            trigger_subheader: trigger.subheader ?? null,
            trigger_url: trigger.url ?? null,
            filtered: false,
            decision_action: "processed", // placeholder until we decide after filtering
            decision_reason: "",
            status: "in_progress",
        },
        select: { id: true },
    });

    return record.id;
}

export async function markRunSkipped(runId: string, reason: string): Promise<void> {
    const prisma = db();
    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            filtered: true,
            decision_action: "skipped",
            decision_reason: reason,
            status: "skipped",
        },
    });
}

export async function appendRunAction(
    runId: string,
    action: RunHistoryAction,
    stepId?: string,
): Promise<string> {
    const result = await db().run_history_actions.create({
        data: {
            run_history_record_id: runId,
            action: action.action,
            integration: convertIntegrationTypeToRunHistoryIntegration(action.integration),
            target: action.target,
            details: action.details,
            url: action.url ?? null,
            step_id: stepId ?? action.step_id ?? null,
            type: action.type,  
        },
    });
    return result.id;
}

export async function markRunProcessed(runId: string, reason?: string): Promise<void> {
    const prisma = db();
    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            filtered: false,
            decision_action: "processed",
            decision_reason: reason ?? "",
        },
    });
}

export async function finalizeRunStatus(runId: string, status: Extract<RunHistoryStatus, "success" | "failed">): Promise<void> {
    const prisma = db();
    await prisma.run_history_records.update({
        where: { id: runId },
        data: { status },
    });
}

export type FailureStage = 'filter' | 'agent';

export async function markRunFailed(runId: string, errorMessage: string, stage?: FailureStage): Promise<void> {
    const prisma = db();
    
    // Prefix error message with failure stage for easy identification
    const prefixedMessage = stage 
        ? `[${stage.toUpperCase()}_ERROR] ${errorMessage}`
        : errorMessage;
    
    await prisma.run_history_records.update({
        where: { id: runId },
        data: {
            status: "failed",
            decision_action: "processed",
            decision_reason: prefixedMessage,
        },
    });
}

/**
 * Stores a chat event in the database and returns the created event's ID
 */
export async function storeChatEvent(runId: string, event: ModelEvent, timestamp?: Date | string): Promise<string> {
    const prisma = db();
    
    // Use provided timestamp or current time
    const eventTimestamp = timestamp 
        ? (typeof timestamp === 'string' ? new Date(timestamp) : timestamp)
        : new Date();
    
    // Store the full event as JSON for easy deserialization
    const created = await prisma.run_history_chat_events.create({
        data: {
            run_history_record_id: runId,
            event_type: event.type as RunHistoryChatEventType,
            event_json: event as any, // Store full ModelEvent as JSON
            timestamp: eventTimestamp,
        },
        select: { id: true },
    });
    
    return created.id;
}

