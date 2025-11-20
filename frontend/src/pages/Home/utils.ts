import { Activity, Zap, Hash } from "lucide-react";
import { StatsResponse } from "../../shared/types";

export interface MetricData {
    label: string;
    value: string;
    change: string;
    trend: "up" | "down";
    description: string;
    subtext: string;
    icon: React.ComponentType<{ className?: string }>;
}

export function formatNumber(num: number): string {
    return num.toLocaleString();
}

export function getTrend(change: string): "up" | "down" {
    return change.startsWith("+") || (!change.startsWith("-") && change !== "0%") ? "up" : "down";
}

export function transformStatsToMetrics(stats: StatsResponse | null): MetricData[] {
    if (!stats) {
        return [];
    }

    return [
        {
            label: "Total events processed",
            value: formatNumber(stats.totalEventsProcessed),
            change: stats.totalEventsProcessedChange,
            trend: getTrend(stats.totalEventsProcessedChange),
            description: "Events processed this month",
            subtext: "Events for the last 6 months",
            icon: Activity,
        },
        {
            label: "Actions Taken",
            value: formatNumber(stats.actionsTaken),
            change: stats.actionsTakenChange,
            trend: getTrend(stats.actionsTakenChange),
            description: "Trending up this month",
            subtext: "Actions for the last 6 months",
            icon: Zap,
        },
        {
            label: "Number of Automations",
            value: formatNumber(stats.numberOfAutomations),
            change: stats.numberOfAutomationsChange,
            trend: getTrend(stats.numberOfAutomationsChange),
            description: "Total automations",
            subtext: "Automations created",
            icon: Hash,
        },
    ];
}

