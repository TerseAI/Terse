import { Prisma } from "@prisma/client"

import { db } from "../../loaders/prisma"

export type RunHistoryWhere = Prisma.run_history_recordsWhereInput

export async function findAgentInOrg(agentId: string, organizationId: string) {
    return db().automations.findFirst({
        where: { id: agentId, organization_id: organizationId }
    })
}

export async function countAndListRunHistory(where: RunHistoryWhere, opts: { skip: number; take: number; includeAgent: boolean }) {
    const prisma = db()
    return prisma.$transaction([
        prisma.run_history_records.count({ where }),
        prisma.run_history_records.findMany({
            where,
            orderBy: { timestamp: "desc" },
            include: opts.includeAgent ? { actions: true, automation: { select: { name: true } } } : { actions: true },
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
            is_test: true
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
