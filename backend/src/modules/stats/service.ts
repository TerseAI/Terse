import { DateTime } from "luxon"
import { RunHistoryRecordWithAgent } from "terse-types/RunHistoryTypes"
import { AgentActivityItem, CountByString, RecentAction, StatsInterval, StatsResponse } from "terse-types/types"

import { convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory, convertPrismaRunHistoryStatusToShared } from "../../common/typeConverters"

import { ChartBucketUnit, fetchAgentNamesByIds, fetchStatsRawData } from "./repository"

const DEFAULT_CHART_TIME_WINDOW_DAYS = 7
export const DEFAULT_TIMEZONE = "UTC"

const STATS_INTERVAL_CONFIG: Record<StatsInterval, { amount: number; unit: ChartBucketUnit }> = {
    "1h": { amount: 60, unit: "minute" },
    "24h": { amount: 24, unit: "hour" },
    "7d": { amount: 7, unit: "day" },
    "1mo": { amount: 30, unit: "day" },
    "3mo": { amount: 90, unit: "day" },
    "1y": { amount: 365, unit: "day" }
}

interface StatsTimeBoundaries {
    currentPeriodStart: Date
    previousPeriodStart: Date
    chartStartDate: Date
    chartBucketUnit: ChartBucketUnit
    chartPointCount: number
}

export function isValidTimezone(tz: string): boolean {
    return DateTime.now().setZone(tz).isValid
}

export function isValidStatsInterval(value: string): value is StatsInterval {
    return value in STATS_INTERVAL_CONFIG
}

function subtractByChartUnit(dt: DateTime, unit: ChartBucketUnit, amount: number): DateTime {
    if (unit === "minute") return dt.minus({ minutes: amount })
    if (unit === "hour") return dt.minus({ hours: amount })
    return dt.minus({ days: amount })
}

function addByChartUnit(dt: DateTime, unit: ChartBucketUnit, amount: number): DateTime {
    if (unit === "minute") return dt.plus({ minutes: amount })
    if (unit === "hour") return dt.plus({ hours: amount })
    return dt.plus({ days: amount })
}

function getBucketStorageKey(dt: DateTime, unit: ChartBucketUnit): string {
    if (unit === "minute") return dt.toFormat("yyyy-MM-dd HH:mm")
    if (unit === "hour") return dt.toFormat("yyyy-MM-dd HH:00")
    return dt.toFormat("yyyy-MM-dd")
}

function getBucketDisplayLabel(dt: DateTime, unit: ChartBucketUnit, pointCount: number): string {
    if (unit === "minute") return dt.toFormat("HH:mm")
    if (unit === "hour") return dt.toFormat("LLL d HH:mm")
    if (pointCount <= 7) return dt.toFormat("ccc")
    return dt.toFormat("LLL d")
}

function resolveStatsTimeBoundaries(nowInTimezone: DateTime, interval?: StatsInterval): StatsTimeBoundaries {
    if (!interval) {
        const currentPeriodStart = nowInTimezone.startOf("month")
        const previousPeriodStart = currentPeriodStart.minus({ months: 1 })
        const chartStartDate = nowInTimezone.minus({ days: DEFAULT_CHART_TIME_WINDOW_DAYS - 1 }).startOf("day")
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

function calculatePercentageChange(previous: number, current: number): string {
    if (previous === 0) return current > 0 ? "+100%" : "0%"
    const change = ((current - previous) / previous) * 100
    const sign = change >= 0 ? "+" : ""
    return `${sign}${change.toFixed(1)}%`
}

export async function buildStatsResponse(organizationId: string, timezone: string, interval?: StatsInterval): Promise<StatsResponse> {
    const nowInTimezone = DateTime.now().setZone(timezone)
    const { currentPeriodStart, previousPeriodStart, chartStartDate, chartBucketUnit, chartPointCount } = resolveStatsTimeBoundaries(nowInTimezone, interval)

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
    ] = await fetchStatsRawData({ organizationId, currentPeriodStart, previousPeriodStart, chartStartDate, chartBucketUnit, timezone })

    const totalEventsChange = calculatePercentageChange(previousTotalEvents, currentTotalEvents)
    const actionsTakenChange = calculatePercentageChange(previousActionsCount, currentActionsCount)
    const channelsChange = currentChannelsCount - previousChannelsCount
    const channelsChangeString = channelsChange >= 0 ? `+${channelsChange}` : `${channelsChange}`

    const eventsByBucketKey = new Map<string, number>()
    for (const row of chartBucketData) {
        eventsByBucketKey.set(row.bucket_key, Number(row.count))
    }

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

    const agentNames = await fetchAgentNamesByIds(agentActivityData.map(a => a.automation_id))
    const agentNameMap = new Map(agentNames.map(a => [a.id, a.name]))

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

    const recentRuns: RunHistoryRecordWithAgent[] = recentRunsData.map(run => ({
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
        filtered: run.filtered,
        decision: {
            action: run.decision_action,
            reasoning: run.decision_reason
        },
        status: convertPrismaRunHistoryStatusToShared(run.status),
        actions: run.actions.map(a => ({
            action: a.action,
            integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(a.integration),
            target: a.target,
            details: a.details,
            url: a.url ?? undefined,
            step_id: a.step_id ?? undefined,
            type: a.type
        })),
        isManuallyTriggered: run.is_manually_triggered
    }))

    return {
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
}
