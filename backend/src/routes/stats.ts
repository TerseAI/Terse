import { Request, Response } from "express";
import { DateTime } from "luxon";
import { db } from "../prismaClient";
import { StatsResponse, DayOfWeek, RecentAction } from "../shared/types";
import { convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory } from "../utility/typeConverters";

// Stats configuration constants
const CHART_TIME_WINDOW_DAYS = 7; // Number of days for the daily events chart
const METRICS_USE_MONTHLY = true; // If true, metrics use monthly periods; if false, use METRICS_TIME_WINDOW_DAYS
const METRICS_TIME_WINDOW_DAYS = 30; // Number of days for metrics when METRICS_USE_MONTHLY is false
const DEFAULT_TIMEZONE = "UTC";

// Type for raw SQL daily events aggregation result
interface DailyEventRow {
    event_date: Date;
    count: bigint;
}

// Validate timezone string is a valid IANA timezone
function isValidTimezone(tz: string): boolean {
    return DateTime.now().setZone(tz).isValid;
}

export async function getStats(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const prisma = db();
    const userId = user.id;

    // Get user's timezone from query param, validate it, or fall back to UTC
    const requestedTimezone = req.query.tz as string | undefined;
    const timezone = requestedTimezone && isValidTimezone(requestedTimezone) 
        ? requestedTimezone 
        : DEFAULT_TIMEZONE;

    // Calculate date ranges for comparison
    const now = new Date();
    let currentPeriodStart: Date;
    let previousPeriodStart: Date;
    let previousPeriodEnd: Date;

    if (METRICS_USE_MONTHLY) {
        currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
        previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Start of previous month
        previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // End of previous month
    } else {
        currentPeriodStart = new Date(now);
        currentPeriodStart.setDate(currentPeriodStart.getDate() - METRICS_TIME_WINDOW_DAYS);
        currentPeriodStart.setHours(0, 0, 0, 0);

        previousPeriodEnd = new Date(currentPeriodStart);
        previousPeriodEnd.setMilliseconds(previousPeriodEnd.getMilliseconds() - 1);

        previousPeriodStart = new Date(previousPeriodEnd);
        previousPeriodStart.setDate(previousPeriodStart.getDate() - METRICS_TIME_WINDOW_DAYS);
        previousPeriodStart.setHours(0, 0, 0, 0);
    }

    // Calculate chart start date for daily events in the user's timezone
    // Use Luxon to correctly calculate midnight N days ago in the user's timezone
    // We use CHART_TIME_WINDOW_DAYS - 1 because the display shows today + (N-1) previous days
    const chartStartDate = DateTime.now()
        .setZone(timezone)
        .minus({ days: CHART_TIME_WINDOW_DAYS - 1 })
        .startOf('day')
        .toJSDate();

    // Run ALL queries in parallel for maximum performance
    const [
        currentTotalEvents,
        previousTotalEvents,
        currentActionsCount,
        previousActionsCount,
        currentChannelsCount,
        previousChannelsCount,
        dailyEventsData,
        recentActionsData,
    ] = await Promise.all([
        // 1. Current period total events
        prisma.run_history_records.count({
            where: {
                automation: { user_id: userId },
                timestamp: { gte: currentPeriodStart },
            },
        }),
        // 2. Previous period total events
        prisma.run_history_records.count({
            where: {
                automation: { user_id: userId },
                timestamp: { gte: previousPeriodStart, lte: previousPeriodEnd },
            },
        }),
        // 3. Current period actions count (write operations only)
        prisma.run_history_actions.count({
            where: {
                run_history_record: {
                    automation: { user_id: userId },
                    timestamp: { gte: currentPeriodStart },
                },
                is_read_only: false,
            },
        }),
        // 4. Previous period actions count (write operations only)
        prisma.run_history_actions.count({
            where: {
                run_history_record: {
                    automation: { user_id: userId },
                    timestamp: { gte: previousPeriodStart, lte: previousPeriodEnd },
                },
                is_read_only: false,
            },
        }),
        // 5. Current channels count
        prisma.automations.count({
            where: { user_id: userId },
        }),
        // 6. Previous period channels count
        prisma.automations.count({
            where: { user_id: userId, created_at: { lte: previousPeriodEnd } },
        }),
        // 7. Daily events aggregation using raw SQL for performance
        // Use AT TIME ZONE to group events by the user's local date
        // GROUP BY 1 refers to the first SELECT column (event_date) to avoid parameter duplication issues
        prisma.$queryRaw<DailyEventRow[]>`
            SELECT DATE(rhr.timestamp AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}) as event_date, COUNT(*) as count
            FROM run_history_records rhr
            INNER JOIN automations a ON rhr.automation_id = a.id
            WHERE a.user_id = ${userId} AND rhr.timestamp >= ${chartStartDate}
            GROUP BY 1
            ORDER BY 1
        `,
        // 8. Recent actions (last 10)
        prisma.run_history_actions.findMany({
            where: {
                run_history_record: {
                    automation: { user_id: userId },
                },
                is_read_only: false,
            },
            include: {
                run_history_record: {
                    include: {
                        automation: { select: { name: true } },
                    },
                },
            },
            orderBy: { created_at: "desc" },
            take: 10,
        }),
    ]);

    // Calculate metric changes
    const totalEventsChange = calculatePercentageChange(previousTotalEvents, currentTotalEvents);
    const actionsTakenChange = calculatePercentageChange(previousActionsCount, currentActionsCount);
    const channelsChange = currentChannelsCount - previousChannelsCount;
    const channelsChangeString = channelsChange >= 0 ? `+${channelsChange}` : `${channelsChange}`;

    // Convert daily events SQL result to the expected format
    const dayNames: DayOfWeek[] = [DayOfWeek.Sun, DayOfWeek.Mon, DayOfWeek.Tue, DayOfWeek.Wed, DayOfWeek.Thu, DayOfWeek.Fri, DayOfWeek.Sat];
    
    // Create a map from date string to count for quick lookup
    // The event_date from SQL is already in the user's timezone
    const eventsByDateStr = new Map<string, number>();
    for (const row of dailyEventsData) {
        // PostgreSQL DATE type comes as a Date object at midnight UTC
        // Extract just the YYYY-MM-DD part
        const dateStr = row.event_date.toISOString().split('T')[0];
        eventsByDateStr.set(dateStr, Number(row.count));
    }

    // Build daily events array with all days in the chart window using Luxon
    const dailyEvents: Array<{ date: DayOfWeek; events: number }> = [];
    
    for (let i = 0; i < CHART_TIME_WINDOW_DAYS; i++) {
        const dt = DateTime.now()
            .setZone(timezone)
            .minus({ days: CHART_TIME_WINDOW_DAYS - 1 - i })
            .startOf('day');
        
        // Get YYYY-MM-DD format for lookup
        const dateStr = dt.toFormat('yyyy-MM-dd');
        
        // Get day of week (1=Monday, 7=Sunday in Luxon, but we need 0=Sunday index)
        const dayIndex = dt.weekday === 7 ? 0 : dt.weekday; // Convert Luxon weekday to JS weekday
        const dayName = dayNames[dayIndex];
        
        dailyEvents.push({
            date: dayName,
            events: eventsByDateStr.get(dateStr) || 0,
        });
    }

    // Transform recent actions data
    const recentActions: RecentAction[] = recentActionsData.map((action) => ({
        action: action.action,
        integration: convertPrismaIntegrationTypeToIntegrationTypeFromRunHistory(action.integration),
        target: action.target,
        details: action.details,
        url: action.url ?? undefined,
        timestamp: action.run_history_record.timestamp.toISOString(),
        channelName: action.run_history_record.automation.name,
    }));

    const response: StatsResponse = {
        totalEventsProcessed: currentTotalEvents,
        totalEventsProcessedChange: totalEventsChange,
        actionsTaken: currentActionsCount,
        actionsTakenChange: actionsTakenChange,
        numberOfChannels: currentChannelsCount,
        numberOfChannelsChange: channelsChangeString,
        dailyEvents,
        recentActions,
        timezone,
    };

    res.json(response);
}

/**
 * Calculate percentage change between two values
 * Returns formatted string like "+12.5%" or "-8.2%"
 */
function calculatePercentageChange(previous: number, current: number): string {
    if (previous === 0) {
        return current > 0 ? "+100%" : "0%";
    }
    const change = ((current - previous) / previous) * 100;
    const sign = change >= 0 ? "+" : "";
    return `${sign}${change.toFixed(1)}%`;
}

