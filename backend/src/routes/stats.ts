import { Request, Response } from "express";
import { db } from "../prismaClient";
import { StatsResponse, DayOfWeek, RecentAction } from "../shared/types";
import { convertRunHistoryIntegrationToIntegrationType } from "../utility/typeConverters";
import { IntegrationType } from "../shared/Integrations";
import type { ToolCallComplete } from "../shared/ModelEvents";

// Stats configuration constants
const CHART_TIME_WINDOW_DAYS = 7; // Number of days for the daily events chart
const METRICS_USE_MONTHLY = true; // If true, metrics use monthly periods; if false, use METRICS_TIME_WINDOW_DAYS
const METRICS_TIME_WINDOW_DAYS = 30; // Number of days for metrics when METRICS_USE_MONTHLY is false

export async function getStats(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const prisma = db();
    const userId = user.id;

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

    // 1. Total Events Processed
    // Count run_history_records for user's channels (this is the source of truth for processed events)
    const [currentTotalEvents, previousTotalEvents] = await Promise.all([
        prisma.run_history_records.count({
            where: {
                automation: {
                    user_id: userId,
                },
                timestamp: {
                    gte: currentPeriodStart,
                },
            },
        }),
        prisma.run_history_records.count({
            where: {
                automation: {
                    user_id: userId,
                },
                timestamp: {
                    gte: previousPeriodStart,
                    lte: previousPeriodEnd,
                },
            },
        }),
    ]);

    const totalEventsChange = calculatePercentageChange(previousTotalEvents, currentTotalEvents);

    // 2. Actions Taken
    // Count completed tool calls from run_history_chat_events for user's channels
    const [currentActionsCount, previousActionsCount] = await Promise.all([
        prisma.run_history_chat_events.count({
            where: {
                event_type: "ToolCallComplete",
                run_history_record: {
                    automation: {
                        user_id: userId,
                    },
                    timestamp: {
                        gte: currentPeriodStart,
                    },
                },
            },
        }),
        prisma.run_history_chat_events.count({
            where: {
                event_type: "ToolCallComplete",
                run_history_record: {
                    automation: {
                        user_id: userId,
                    },
                    timestamp: {
                        gte: previousPeriodStart,
                        lte: previousPeriodEnd,
                    },
                },
            },
        }),
    ]);

    const actionsTakenChange = calculatePercentageChange(previousActionsCount, currentActionsCount);

    // 3. Number of Channels
    // Count user's channels
    const [currentChannelsCount, previousChannelsCount] = await Promise.all([
        prisma.automations.count({
            where: {
                user_id: userId,
            },
        }),
        prisma.automations.count({
            where: {
                user_id: userId,
                created_at: { lte: previousPeriodEnd },
            },
        }),
    ]);

    const channelsChange = currentChannelsCount - previousChannelsCount;
    const channelsChangeString = channelsChange >= 0 ? `+${channelsChange}` : `${channelsChange}`;

    // 4. Daily Events (chart time window)
    const chartStartDate = new Date(now);
    chartStartDate.setDate(chartStartDate.getDate() - CHART_TIME_WINDOW_DAYS);
    chartStartDate.setHours(0, 0, 0, 0);

    // Get all run history records for the chart time window
    const recentRecords = await prisma.run_history_records.findMany({
        where: {
            automation: {
                user_id: userId,
            },
            timestamp: {
                gte: chartStartDate,
            },
        },
        select: {
            timestamp: true,
        },
    });

    // Group by day and count events
    const dayNames: DayOfWeek[] = [DayOfWeek.Sun, DayOfWeek.Mon, DayOfWeek.Tue, DayOfWeek.Wed, DayOfWeek.Thu, DayOfWeek.Fri, DayOfWeek.Sat];
    const eventsByDay = new Map<DayOfWeek, number>();

    // Initialize all days in the chart time window with 0
    for (let i = 0; i < CHART_TIME_WINDOW_DAYS; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (CHART_TIME_WINDOW_DAYS - 1 - i));
        date.setHours(0, 0, 0, 0);
        const dayName = dayNames[date.getDay()];
        eventsByDay.set(dayName, 0);
    }

    // Count events per day
    for (const record of recentRecords) {
        const recordDate = new Date(record.timestamp);
        recordDate.setHours(0, 0, 0, 0);
        const dayName = dayNames[recordDate.getDay()];
        const currentCount = eventsByDay.get(dayName) || 0;
        eventsByDay.set(dayName, currentCount + 1);
    }

    // Convert to array format, ensuring we have all days in the chart time window in order
    const dailyEvents: Array<{ date: DayOfWeek; events: number }> = [];
    for (let i = 0; i < CHART_TIME_WINDOW_DAYS; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (CHART_TIME_WINDOW_DAYS - 1 - i));
        const dayName = dayNames[date.getDay()];
        dailyEvents.push({
            date: dayName,
            events: eventsByDay.get(dayName) || 0,
        });
    }

    // 5. Recent Actions (last 10 completed tool calls)
    const recentToolCallsData = await prisma.run_history_chat_events.findMany({
        where: {
            event_type: "ToolCallComplete",
            run_history_record: {
                automation: {
                    user_id: userId,
                },
            },
        },
        include: {
            run_history_record: {
                include: {
                    automation: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            timestamp: "desc",
        },
        take: 10,
    });

    const recentActions: RecentAction[] = recentToolCallsData.map((event) => {
        const toolCallComplete = event.event_json as ToolCallComplete;
        
        // Integration is now required and provided directly from the tool call event
        const integration = toolCallComplete.integration as IntegrationType;

        // Generate details from status and changed items
        let details = toolCallComplete.status === "success" ? "Tool call completed successfully" : toolCallComplete.status;
        if (toolCallComplete.changed_items && toolCallComplete.changed_items.length > 0) {
            const itemsSummary = toolCallComplete.changed_items
                .map(item => `${item.change_event_type} ${item.type_name}`)
                .join(", ");
            details = `${details}. ${itemsSummary}`;
        }

        return {
            action: toolCallComplete.tool_name,
            integration: integration,
            target: '',
            details: details,
            url: toolCallComplete.url ?? undefined,
            timestamp: event.timestamp.toISOString(),
            channelName: event.run_history_record.automation.name,
        };
    });

    const response: StatsResponse = {
        totalEventsProcessed: currentTotalEvents,
        totalEventsProcessedChange: totalEventsChange,
        actionsTaken: currentActionsCount,
        actionsTakenChange: actionsTakenChange,
        numberOfChannels: currentChannelsCount,
        numberOfChannelsChange: channelsChangeString,
        dailyEvents,
        recentActions,
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

