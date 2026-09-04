import { Prisma } from "@prisma/client"

import { db } from "../../loaders/prisma"

export type RunHistoryWhere = Prisma.run_history_recordsWhereInput

export async function findAgentInOrg(agentId: string, organizationId: string) {
    return db().automations.findFirst({
        where: { id: agentId, organization_id: organizationId }
    })
}

export async function findAutomationIdsInOrg(organizationId: string): Promise<string[]> {
    const automations = await db().automations.findMany({
        where: { organization_id: organizationId },
        select: { id: true }
    })
    return automations.map(automation => automation.id)
}

const runHistoryActionSummarySelect = {
    action: true,
    integration: true,
    target: true,
    details: true,
    url: true,
    step_id: true,
    type: true
} satisfies Prisma.run_history_actionsSelect

export type RunHistoryActionSummary = Prisma.run_history_actionsGetPayload<{ select: typeof runHistoryActionSummarySelect }>

export async function countAndListRunHistory(where: RunHistoryWhere, opts: { skip: number; take: number; includeAgent: boolean }) {
    const prisma = db()
    return Promise.all([
        prisma.run_history_records.count({ where }),
        prisma.run_history_records.findMany({
            where,
            orderBy: { timestamp: "desc" },
            // Explicit select — this list view never reads trigger_payload/sdk_skills, and both
            // can be large (trigger_payload observed up to several hundred KB per row in prod).
            select: {
                id: true,
                automation_id: true,
                timestamp: true,
                event: true,
                trigger_integration: true,
                trigger_source: true,
                trigger_title: true,
                trigger_subheader: true,
                trigger_url: true,
                filtered: true,
                decision_action: true,
                decision_reason: true,
                status: true,
                is_manually_triggered: true,
                is_test: true,
                triggered_by_user_id: true,
                replay_of_run_id: true,
                execution_region: true,
                actions: { select: runHistoryActionSummarySelect },
                ...(opts.includeAgent ? { automation: { select: { name: true } } } : {})
            },
            skip: opts.skip,
            take: opts.take
        })
    ])
}

export async function findRunRecordForChat(runId: string, organizationId: string) {
    return db().run_history_records.findFirst({
        where: {
            id: runId,
            automation: { organization_id: organizationId }
        },
        select: {
            timestamp: true,
            updated_at: true,
            status: true,
            trigger_payload: true,
            is_test: true,
            failure_snapshots: {
                where: { restored_at: null },
                orderBy: { created_at: "desc" },
                take: 1,
                select: { id: true }
            }
        }
    })
}

export async function findRunForFailureRetry(runId: string, organizationId: string) {
    return db().run_history_records.findFirst({
        where: { id: runId, automation: { organization_id: organizationId } },
        select: {
            status: true,
            automation: { select: { id: true, name: true, user_id: true } },
            failure_snapshots: {
                where: { restored_at: null },
                orderBy: { created_at: "desc" },
                take: 1,
                select: { id: true }
            }
        }
    })
}

export async function findActionsByIdsInOrg(ids: string[], organizationId: string) {
    return db().run_history_actions.findMany({
        where: {
            id: { in: ids },
            run_history_record: {
                automation: { organization_id: organizationId }
            }
        }
    })
}
