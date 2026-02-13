import { Request, Response } from "express"
import { DateTime } from "luxon"

import { db } from "../prismaClient"
import { AgentActivityItem, CountByString, RecentAction, RecentRun, StatsInterval, StatsResponse } from "../shared/types"
import { convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory } from "../utility/typeConverters"

// Stats configuration constants
const DEFAULT_CHART_TIME_WINDOW_DAYS = 7 // Fallback chart period when no custom interval is requested
const DEFAULT_TIMEZONE = "UTC"
type ChartBucketUnit = "minute" | "hour" | "day"
const STATS_INTERVAL_CONFIG: Record<StatsInterval, { amount: number; unit: ChartBucketUnit }> = {
    "1h": { amount: 60, unit: "minute" },
    "24h": { amount: 24, unit: "hour" },
    "7d": { amount: 7, unit: "day" },
    "1mo": { amount: 30, unit: "day" },
    "3mo": { amount: 90, unit: "day" },
    "1y": { amount: 365, unit: "day" }
}

// Type for raw SQL chart aggregation result
interface ChartBucketRow {
    bucket_key: string
    count: bigint
}

interface StatsTimeBoundaries {
    currentPeriodStart: Date
    previousPeriodStart: Date
    chartStartDate: Date
    chartBucketUnit: ChartBucketUnit
    chartPointCount: number
}

// Validate timezone string is a valid IANA timezone
function isValidTimezone(tz: string): boolean {
    return DateTime.now().setZone(tz).isValid
}

function isValidStatsInterval(value: string): value is StatsInterval {
    return value in STATS_INTERVAL_CONFIG
}

function subtractByChartUnit(dt: DateTime, unit: ChartBucketUnit, amount: number): DateTime {
    if (unit === "minute") {
        return dt.minus({ minutes: amount })
    }
    if (unit === "hour") {
        return dt.minus({ hours: amount })
    }
    return dt.minus({ days: amount })
}

function addByChartUnit(dt: DateTime, unit: ChartBucketUnit, amount: number): DateTime {
    if (unit === "minute") {
        return dt.plus({ minutes: amount })
    }
    if (unit === "hour") {
        return dt.plus({ hours: amount })
    }
    return dt.plus({ days: amount })
}

function getBucketStorageKey(dt: DateTime, unit: ChartBucketUnit): string {
    if (unit === "minute") {
        return dt.toFormat("yyyy-MM-dd HH:mm")
    }
    if (unit === "hour") {
        return dt.toFormat("yyyy-MM-dd HH:00")
    }
    return dt.toFormat("yyyy-MM-dd")
}

function getBucketDisplayLabel(dt: DateTime, unit: ChartBucketUnit, pointCount: number): string {
    if (unit === "minute") {
        return dt.toFormat("HH:mm")
    }
    if (unit === "hour") {
        return dt.toFormat("LLL d HH:mm")
    }
    if (pointCount <= 7) {
        return dt.toFormat("ccc")
    }
    return dt.toFormat("LLL d")
}

function resolveStatsTimeBoundaries(nowInTimezone: DateTime, interval?: StatsInterval): StatsTimeBoundaries {
    if (!interval) {
        const currentPeriodStart = nowInTimezone.startOf("month")
        const previousPeriodStart = currentPeriodStart.minus({ months: 1 })
        const chartStartDate = nowInTimezone
            .minus({ days: DEFAULT_CHART_TIME_WINDOW_DAYS - 1 })
            .startOf("day")

        return {
            currentPeriodStart: currentPeriodStart.toJSDate(),
            previousPeriodStart: previousPeriodStart.toJSDate(),
            chartStartDate: chartStartDate.toJSDate(),
            chartBucketUnit: "day",
            chartPointCount: DEFAULT_CHART_TIME_WINDOW_DAYS
        }
    }

    const config = STATS_INTERVAL_CONFIG[interval]
    const chartEnd = nowInTimezone.startOf(config.unit)
    const currentPeriodStart = subtractByChartUnit(chartEnd, config.unit, config.amount - 1)
    const previousPeriodStart = subtractByChartUnit(currentPeriodStart, config.unit, config.amount)

    return {
        currentPeriodStart: currentPeriodStart.toJSDate(),
        previousPeriodStart: previousPeriodStart.toJSDate(),
        chartStartDate: currentPeriodStart.toJSDate(),
        chartBucketUnit: config.unit,
        chartPointCount: config.amount
    }
}

export async function getStats(req: Request, res: Response) {
    const user = req.session?.user
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" })
    }

    const prisma = db()
    const organizationId = user.organizationId
    if (!organizationId) {
        return res.status(400).json({ error: "Organization context is required" })
    }

    // Get user's timezone from query param, validate it, or fall back to UTC
    const requestedTimezone = req.query.tz as string | undefined
    const timezone = requestedTimezone && isValidTimezone(requestedTimezone) ? requestedTimezone : DEFAULT_TIMEZONE
    const requestedInterval = req.query.interval as string | undefined
    const interval = requestedInterval && isValidStatsInterval(requestedInterval) ? requestedInterval : undefined

    const nowInTimezone = DateTime.now().setZone(timezone)
    const { currentPeriodStart, previousPeriodStart, chartStartDate, chartBucketUnit, chartPointCount } = resolveStatsTimeBoundaries(nowInTimezone, interval)
    const chartAggregationQuery =
        chartBucketUnit === "minute"
            ? prisma.$queryRaw<ChartBucketRow[]>`
                  SELECT TO_CHAR(DATE_TRUNC('minute', rhr.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM-DD HH24:MI') as bucket_key, COUNT(*) as count
                  FROM run_history_records rhr
                  INNER JOIN automations a ON rhr.automation_id = a.id
                  WHERE a.organization_id = ${organizationId} AND rhr.status != 'skipped' AND rhr.timestamp >= ${chartStartDate}
                  GROUP BY 1
                  ORDER BY 1
              `
            : chartBucketUnit === "hour"
              ? prisma.$queryRaw<ChartBucketRow[]>`
                    SELECT TO_CHAR(DATE_TRUNC('hour', rhr.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM-DD HH24:00') as bucket_key, COUNT(*) as count
                    FROM run_history_records rhr
                    INNER JOIN automations a ON rhr.automation_id = a.id
                    WHERE a.organization_id = ${organizationId} AND rhr.status != 'skipped' AND rhr.timestamp >= ${chartStartDate}
                    GROUP BY 1
                    ORDER BY 1
                `
              : prisma.$queryRaw<ChartBucketRow[]>`
                    SELECT TO_CHAR(DATE_TRUNC('day', rhr.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}), 'YYYY-MM-DD') as bucket_key, COUNT(*) as count
                    FROM run_history_records rhr
                    INNER JOIN automations a ON rhr.automation_id = a.id
                    WHERE a.organization_id = ${organizationId} AND rhr.status != 'skipped' AND rhr.timestamp >= ${chartStartDate}
                    GROUP BY 1
                    ORDER BY 1
                `

    // Run ALL queries in parallel for maximum performance
    const [
        currentTotalEvents,
        previousTotalEvents,
        currentActionsCount,
        previousActionsCount,
        currentChannelsCount,
        previousChannelsCount,
        chartBucketData,
        recentActionsData,
        recentRunsData,
        agentActivityData,
        statusBreakdownData,
        triggerIntegrationData,
        actionIntegrationData,
        actionTypeData
    ] = await Promise.all([
        // 1. Current period total events (exclude filtered/skipped)
        prisma.run_history_records.count({
            where: {
                automation: { organization_id: organizationId },
                status: { not: "skipped" },
                timestamp: { gte: currentPeriodStart }
            }
        }),
        // 2. Previous period total events (exclude filtered/skipped)
        prisma.run_history_records.count({
            where: {
                automation: { organization_id: organizationId },
                status: { not: "skipped" },
                timestamp: { gte: previousPeriodStart, lt: currentPeriodStart }
            }
        }),
        // 3. Current period actions count (write operations only)
        prisma.run_history_actions.count({
            where: {
                run_history_record: {
                    automation: { organization_id: organizationId },
                    timestamp: { gte: currentPeriodStart }
                },
                is_read_only: false
            }
        }),
        // 4. Previous period actions count (write operations only)
        prisma.run_history_actions.count({
            where: {
                run_history_record: {
                    automation: { organization_id: organizationId },
                    timestamp: { gte: previousPeriodStart, lt: currentPeriodStart }
                },
                is_read_only: false
            }
        }),
        // 5. Current active agents count
        prisma.automations.count({
            where: { organization_id: organizationId, is_active: true }
        }),
        // 6. Previous period active agents count
        prisma.automations.count({
            where: { organization_id: organizationId, is_active: true, created_at: { lt: currentPeriodStart } }
        }),
        // 7. Chart events aggregation for the selected interval
        chartAggregationQuery,
        // 8. Recent actions (last 10, active agents only)
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
        // 9. Recent non-filtered runs (last 20) across all active agents
        prisma.run_history_records.findMany({
            where: {
                automation: { organization_id: organizationId },
                status: { not: "skipped" }
            },
            include: {
                automation: { select: { name: true } },
                actions: {
                    select: {
                        action: true,
                        integration: true,
                        type: true
                    }
                }
            },
            orderBy: { timestamp: "desc" },
            take: 20
        }),
        // 10. Top 10 most active agents by triggered run count (current period, exclude skipped)
        prisma.run_history_records.groupBy({
            by: ["automation_id"],
            where: {
                automation: { organization_id: organizationId },
                status: { not: "skipped" },
                timestamp: { gte: currentPeriodStart }
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 10
        }),
        // 11. Status breakdown (current period, exclude skipped)
        prisma.run_history_records.groupBy({
            by: ["status"],
            where: {
                automation: { organization_id: organizationId },
                status: { not: "skipped" },
                timestamp: { gte: currentPeriodStart }
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } }
        }),
        // 12. Trigger integrations breakdown (current period, exclude skipped)
        prisma.run_history_records.groupBy({
            by: ["trigger_integration"],
            where: {
                automation: { organization_id: organizationId },
                status: { not: "skipped" },
                timestamp: { gte: currentPeriodStart }
            },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } }
        }),
        // 13. Action integrations breakdown (current period, write-only)
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
        // 14. Action types breakdown (current period, write-only)
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

    // Calculate metric changes
    const totalEventsChange = calculatePercentageChange(previousTotalEvents, currentTotalEvents)
    const actionsTakenChange = calculatePercentageChange(previousActionsCount, currentActionsCount)
    const channelsChange = currentChannelsCount - previousChannelsCount
    const channelsChangeString = channelsChange >= 0 ? `+${channelsChange}` : `${channelsChange}`

    // Create a map from bucket key to count for quick lookup
    const eventsByBucketKey = new Map<string, number>()
    for (const row of chartBucketData) {
        eventsByBucketKey.set(row.bucket_key, Number(row.count))
    }

    // Build chart events array with all buckets in the selected window
    const dailyEvents: Array<{ date: string; events: number }> = []
    let cursor = DateTime.fromJSDate(chartStartDate).setZone(timezone).startOf(chartBucketUnit)

    for (let i = 0; i < chartPointCount; i++) {
        const bucketKey = getBucketStorageKey(cursor, chartBucketUnit)
        dailyEvents.push({
            date: getBucketDisplayLabel(cursor, chartBucketUnit, chartPointCount),
            events: eventsByBucketKey.get(bucketKey) || 0
        })
        cursor = addByChartUnit(cursor, chartBucketUnit, 1)
    }

    // Transform recent actions data
    const recentActions: RecentAction[] = recentActionsData.map(action => ({
        action: action.action,
        integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(action.integration),
        target: action.target,
        details: action.details,
        url: action.url ?? undefined,
        timestamp: action.run_history_record.timestamp.toISOString(),
        agentName: action.run_history_record.automation.name,
        type: action.type
    }))

    // Resolve agent names for activity data
    const agentIds = agentActivityData.map(a => a.automation_id)
    const agentNames =
        agentIds.length > 0
            ? await prisma.automations.findMany({
                  where: { id: { in: agentIds } },
                  select: { id: true, name: true }
              })
            : []
    const agentNameMap = new Map(agentNames.map(a => [a.id, a.name]))

    // Transform insight data
    const agentActivity: AgentActivityItem[] = agentActivityData.map(a => ({
        agentId: a.automation_id,
        agentName: agentNameMap.get(a.automation_id) ?? "Unknown",
        runCount: a._count.id
    }))

    const statusBreakdown: CountByString[] = statusBreakdownData.map(s => ({
        label: s.status,
        count: s._count.id
    }))

    const triggerIntegrations: CountByString[] = triggerIntegrationData.map(t => ({
        label: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(t.trigger_integration),
        count: t._count.id
    }))

    const actionIntegrations: CountByString[] = actionIntegrationData.map(a => ({
        label: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(a.integration),
        count: a._count.id
    }))

    const actionTypes: CountByString[] = actionTypeData.map(a => ({
        label: a.type,
        count: a._count.id
    }))

    // Transform recent runs data
    const recentRuns: RecentRun[] = recentRunsData.map(run => ({
        id: run.id,
        agentId: run.automation_id,
        agentName: run.automation.name,
        timestamp: run.timestamp.toISOString(),
        trigger: {
            event: run.event,
            integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(run.trigger_integration),
            source: run.trigger_source,
            title: run.trigger_title ?? undefined,
            subheader: run.trigger_subheader ?? undefined,
            url: run.trigger_url ?? undefined
        },
        status: run.status,
        actions: run.actions.map(a => ({
            action: a.action,
            integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(a.integration),
            type: a.type
        }))
    }))

    const response: StatsResponse = {
        totalEventsProcessed: currentTotalEvents,
        totalEventsProcessedChange: totalEventsChange,
        actionsTaken: currentActionsCount,
        actionsTakenChange: actionsTakenChange,
        numberOfAgents: currentChannelsCount,
        numberOfAgentsChange: channelsChangeString,
        dailyEvents,
        recentActions,
        recentRuns,
        timezone,
        agentActivity,
        statusBreakdown,
        triggerIntegrations,
        actionIntegrations,
        actionTypes
    }

    res.json(response)
}

/**
 * Calculate percentage change between two values
 * Returns formatted string like "+12.5%" or "-8.2%"
 */
function calculatePercentageChange(previous: number, current: number): string {
    if (previous === 0) {
        return current > 0 ? "+100%" : "0%"
    }
    const change = ((current - previous) / previous) * 100
    const sign = change >= 0 ? "+" : ""
    return `${sign}${change.toFixed(1)}%`
}
