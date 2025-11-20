import { useRecentAutomations } from "../../hooks/api/useRecentAutomations";
import { useStats } from "../../hooks/api/useStats";
import { formatRelativeTime } from "../../utility/timeUtils";
import { IntegrationType } from "../../shared/Integrations";
import { RunHistoryAction } from "../../shared/RunHistoryTypes";
import { StatsMetricsSection } from "./components/StatsMetricsSection";
import { DailyEventsChart } from "./components/DailyEventsChart";
import { RecentActionsSection } from "./components/RecentActionsSection";
import { RecentAutomationsSection } from "./components/RecentAutomationsSection";
import { transformStatsToMetrics } from "./utils";

function Home() {
    const { automations: recentAutomationsData, isLoading: isLoadingAutomations } = useRecentAutomations(3);
    const { stats, isLoading: isLoadingStats } = useStats();

    const metrics = transformStatsToMetrics(stats);

    const recentAutomations = recentAutomationsData.map(automation => ({
        ...automation,
        lastEdited: formatRelativeTime(automation.updatedAt),
        lastEventProcessedAt: automation.lastEventProcessedAt
            ? formatRelativeTime(automation.lastEventProcessedAt)
            : "Never",
    }));

    const eventsPerDay = stats?.dailyEvents || [];

    const recentActions: (RunHistoryAction & { timestamp: string; automationName: string })[] = stats?.recentActions
        ? stats.recentActions.map((action) => ({
              action: action.action,
              integration: action.integration as IntegrationType,
              target: action.target,
              details: action.details,
              url: action.url,
              timestamp: formatRelativeTime(action.timestamp),
              automationName: action.automationName,
          }))
        : [];

    return (
        <div className="mx-auto p-8 space-y-8">
            <StatsMetricsSection isLoading={isLoadingStats} metrics={metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DailyEventsChart eventsPerDay={eventsPerDay} />
                <RecentActionsSection recentActions={recentActions} />
            </div>

            <RecentAutomationsSection 
                isLoading={isLoadingAutomations} 
                automations={recentAutomations} 
            />
        </div>
    );
}

export default Home;

