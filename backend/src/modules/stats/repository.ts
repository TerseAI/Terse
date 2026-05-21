import { RunHistoryStatus as PrismaRunHistoryStatus } from "@prisma/client"

import { db } from "../../loaders/prisma"

export type ChartBucketUnit = "minute" | "hour" | "day"

interface ChartBucketRow {
    bucket_key: string
    count: bigint
}

export interface StatsQueryBoundaries {
    organizationId: string
    currentPeriodStart: Date
    previousPeriodStart: Date
    chartStartDate: Date
    chartBucketUnit: ChartBucketUnit
    timezone: string
}

export async function fetchStatsRawData(boundaries: StatsQueryBoundaries) {
    const { organizationId, currentPeriodStart, previousPeriodStart, chartStartDate, chartBucketUnit, timezone } = boundaries
    const prisma = db()

    const chartAggregationQuery =
        chartBucketUnit === "minute"
            ? prisma.$queryRaw<ChartBucketRow[]>`
                    SELECT TO_CHAR(DATE_TRUNC('minute', rhr.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM-DD HH24:MI') as bucket_key, COUNT(*) as count
                    FROM run_history_records rhr
                    INNER JOIN automations a ON rhr.automation_id = a.id
                    WHERE a.organization_id = ${organizationId} AND rhr.status != ${PrismaRunHistoryStatus.skipped}::"RunHistoryStatus" AND rhr.timestamp >= ${chartStartDate}
                    GROUP BY 1
                    ORDER BY 1
                `
            : chartBucketUnit === "hour"
              ? prisma.$queryRaw<ChartBucketRow[]>`
                    SELECT TO_CHAR(DATE_TRUNC('hour', rhr.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM-DD HH24:00') as bucket_key, COUNT(*) as count
                    FROM run_history_records rhr
                    INNER JOIN automations a ON rhr.automation_id = a.id
                    WHERE a.organization_id = ${organizationId} AND rhr.status != ${PrismaRunHistoryStatus.skipped}::"RunHistoryStatus" AND rhr.timestamp >= ${chartStartDate}
                    GROUP BY 1
                    ORDER BY 1
                `
              : prisma.$queryRaw<ChartBucketRow[]>`
                    SELECT TO_CHAR(DATE_TRUNC('day', rhr.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM-DD') as bucket_key, COUNT(*) as count
                    FROM run_history_records rhr
                    INNER JOIN automations a ON rhr.automation_id = a.id
                    WHERE a.organization_id = ${organizationId} AND rhr.status != ${PrismaRunHistoryStatus.skipped}::"RunHistoryStatus" AND rhr.timestamp >= ${chartStartDate}
                    GROUP BY 1
                    ORDER BY 1
                `

    return Promise.all([
        prisma.run_history_records.count({
            where: {
                automation: { organization_id: organizationId },
                status: { not: PrismaRunHistoryStatus.skipped },
                timestamp: { gte: currentPeriodStart }
            }
        }),
        prisma.run_history_records.count({
            where: {
                automation: { organization_id: organizationId },
                status: { not: PrismaRunHistoryStatus.skipped },
                timestamp: { gte: previousPeriodStart, lt: currentPeriodStart }
            }
        }),
        prisma.run_history_actions.count({
            where: {
                run_history_record: {
                    automation: { organization_id: organizationId },
                    timestamp: { gte: currentPeriodStart }
                },
                is_read_only: false
            }
        }),
        prisma.run_history_actions.count({
            where: {
                run_history_record: {
                    automation: { organization_id: organizationId },
                    timestamp: { gte: previousPeriodStart, lt: currentPeriodStart }
                },
                is_read_only: false
            }
        }),
        prisma.automations.count({
            where: { organization_id: organizationId, is_active: true }
        }),
        prisma.automations.count({
            where: { organization_id: organizationId, is_active: true, created_at: { lt: currentPeriodStart } }
        }),
        chartAggregationQuery,
        prisma.run_history_actions.findMany({
            where: {
                run_history_record: {
                    automation: { organization_id: organizationId }
                },
                is_read_only: false
            },
            include: {
                run_history_record: {
                    include: {
                        automation: { select: { name: true } }
                    }
                }
            },
            orderBy: { created_at: "desc" },
            take: 10
        }),
        prisma.run_history_records.findMany({
            where: {
                automation: { organization_id: organizationId },
                status: { not: PrismaRunHistoryStatus.skipped }
            },
            include: {
                automation: { select: { name: true } },
                actions: true
            },
            orderBy: { timestamp: "desc" },
            take: 20
        }),
        prisma.run_history_records.groupBy({
            by: ["automation_id"],
            where: {
                automation: { organization_id: organizationId },
                status: { not: PrismaRunHistoryStatus.skipped },
                timestamp: { gte: currentPeriodStart }
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 10
        }),
        prisma.run_history_records.groupBy({
            by: ["status"],
            where: {
                automation: { organization_id: organizationId },
                status: { not: PrismaRunHistoryStatus.skipped },
                timestamp: { gte: currentPeriodStart }
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } }
        }),
        prisma.run_history_records.groupBy({
            by: ["trigger_integration"],
            where: {
                automation: { organization_id: organizationId },
                status: { not: PrismaRunHistoryStatus.skipped },
                timestamp: { gte: currentPeriodStart }
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } }
        }),
        prisma.run_history_actions.groupBy({
            by: ["integration"],
            where: {
                run_history_record: {
                    automation: { organization_id: organizationId },
                    timestamp: { gte: currentPeriodStart }
                },
                is_read_only: false
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } }
        }),
        prisma.run_history_actions.groupBy({
            by: ["type"],
            where: {
                run_history_record: {
                    automation: { organization_id: organizationId },
                    timestamp: { gte: currentPeriodStart }
                },
                is_read_only: false
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } }
        })
    ])
}

export async function fetchAgentNamesByIds(ids: string[]): Promise<Array<{ id: string; name: string }>> {
    if (ids.length === 0) return []
    return db().automations.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true }
    })
}
