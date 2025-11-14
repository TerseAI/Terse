import { db } from "../../prismaClient";
import type { RunHistoryAction as SharedRunHistoryAction, RunHistoryStatus, RunHistoryTrigger } from "../../shared/RunHistoryTypes";

export type RunTrigger = RunHistoryTrigger;

function mapIntegration(integration: RunTrigger["integration"]) {
    // Prisma enum values match lowercase strings in schema
    return integration;
}

export async function createRunRecord(params: {
    automationId: string;
    trigger: RunTrigger;
}): Promise<string> {
    const { automationId, trigger } = params;
    const prisma = db();
    const record = await prisma.run_history_records.create({
        data: {
            automation_id: automationId,
            event: trigger.event,
            trigger_integration: mapIntegration(trigger.integration) as any,
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

export async function appendRunAction(
    runId: string,
    action: SharedRunHistoryAction,
): Promise<void> {
    await db().run_history_actions.create({
        data: {
            run_history_record_id: runId,
            action: action.action,
            integration: mapIntegration(action.integration),
            target: action.target,
            details: action.details,
            url: action.url ?? null,
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

