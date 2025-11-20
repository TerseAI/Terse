import { Request, Response } from "express";
import { db } from "../prismaClient";
import { StatsResponse, DayOfWeek, RecentAction } from "../shared/types";
import { convertRunHistoryIntegrationToIntegrationType } from "../utility/typeConverters";

export async function getStats(req: Request, res: Response) {
    const user = req.session?.user;
    if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const prisma = db();
        const userId = user.id;

        // Calculate date ranges for comparison
        const now = new Date();
        const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month
        const previousPeriodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Start of previous month
        const previousPeriodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // End of previous month

        // 1. Total Events Processed
        // Count run_history_records for user's automations (this is the source of truth for processed events)
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
        // Count actions from run_history_actions for user's automations
        const [currentActionsCount, previousActionsCount] = await Promise.all([
            prisma.run_history_actions.count({
                where: {
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
            prisma.run_history_actions.count({
                where: {
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

        // 3. Number of Automations
        // Count user's automations
        const [currentAutomationsCount, previousAutomationsCount] = await Promise.all([
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

        const automationsChange = currentAutomationsCount - previousAutomationsCount;
        const automationsChangeString = automationsChange >= 0 ? `+${automationsChange}` : `${automationsChange}`;

        // 4. Daily Events (last 7 days)
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // Get all run history records for the last 7 days
        const recentRecords = await prisma.run_history_records.findMany({
            where: {
                automation: {
                    user_id: userId,
                },
                timestamp: {
                    gte: sevenDaysAgo,
                },
            },
            select: {
                timestamp: true,
            },
        });

        // Group by day and count events
        const dayNames: DayOfWeek[] = [DayOfWeek.Sun, DayOfWeek.Mon, DayOfWeek.Tue, DayOfWeek.Wed, DayOfWeek.Thu, DayOfWeek.Fri, DayOfWeek.Sat];
        const eventsByDay = new Map<DayOfWeek, number>();

        // Initialize all 7 days with 0
        for (let i = 0; i < 7; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - (6 - i));
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

        // Convert to array format, ensuring we have the last 7 days in order
        const dailyEvents: Array<{ date: DayOfWeek; events: number }> = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - (6 - i));
            const dayName = dayNames[date.getDay()];
            dailyEvents.push({
                date: dayName,
                events: eventsByDay.get(dayName) || 0,
            });
        }

        // 5. Recent Actions (last 10)
        const recentActionsData = await prisma.run_history_actions.findMany({
            where: {
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
                created_at: "desc",
            },
            take: 10,
        });

        const recentActions: RecentAction[] = recentActionsData.map((action) => ({
            action: action.action,
            integration: convertRunHistoryIntegrationToIntegrationType(action.integration) as string,
            target: action.target,
            details: action.details,
            url: action.url ?? undefined,
            timestamp: action.run_history_record.timestamp.toISOString(),
            automationName: action.run_history_record.automation.name,
        }));

        const response: StatsResponse = {
            totalEventsProcessed: currentTotalEvents,
            totalEventsProcessedChange: totalEventsChange,
            actionsTaken: currentActionsCount,
            actionsTakenChange: actionsTakenChange,
            numberOfAutomations: currentAutomationsCount,
            numberOfAutomationsChange: automationsChangeString,
            dailyEvents,
            recentActions,
        };

        res.json(response);
    } catch (err) {
        console.error("Error fetching stats:", err);
        res.status(500).json({
            error: "Failed to fetch stats",
            details: err instanceof Error ? err.message : "Unknown error",
        });
    }
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

