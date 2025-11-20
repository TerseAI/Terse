import { Request, Response } from "express";
import { db } from "../prismaClient";
import { StatsResponse } from "../shared/types";

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

        const response: StatsResponse = {
            totalEventsProcessed: currentTotalEvents,
            totalEventsProcessedChange: totalEventsChange,
            actionsTaken: currentActionsCount,
            actionsTakenChange: actionsTakenChange,
            numberOfAutomations: currentAutomationsCount,
            numberOfAutomationsChange: automationsChangeString,
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

