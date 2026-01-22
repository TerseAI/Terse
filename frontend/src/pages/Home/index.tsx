import { useRecentAgents } from "../../hooks/api/useRecentAgents";
import { useStats } from "../../hooks/api/useStats";
import { useAgents } from "../../hooks/api/useAgents";
import { formatRelativeTime } from "../../utility/timeUtils";
import { IntegrationType } from "../../shared/Integrations";
import { RunHistoryAction } from "../../shared/RunHistoryTypes";
import { StatsMetricsSection } from "./components/StatsMetricsSection";
import { DailyEventsChart } from "./components/DailyEventsChart";
import { RecentActionsSection } from "./components/RecentActionsSection";
import { RecentAgentsSection } from "./components/RecentAgentsSection";
import { HomeEmptyState } from "./components/HomeEmptyState";
import { transformStatsToMetrics } from "./utils";

function Home() {
    const { agents: allAgents, isLoading: isLoadingAllAgents } = useAgents({ limit: 1 });
    const { agents: recentAgentsData, isLoading: isLoadingAgents } = useRecentAgents(3);
    const { stats, isLoading: isLoadingStats } = useStats();

    const hasNoAgents = !isLoadingAllAgents && allAgents.length === 0;

    // Show empty state if user has no agents
    if (hasNoAgents) {
        return <HomeEmptyState />;
    }

    const metrics = transformStatsToMetrics(stats);

    const recentAgents = recentAgentsData.map(agent => ({
        ...agent,
        lastEdited: formatRelativeTime(agent.updatedAt),
        lastEventProcessedAt: agent.lastEventProcessedAt
            ? formatRelativeTime(agent.lastEventProcessedAt)
            : "Never",
    }));

    const eventsPerDay = stats?.dailyEvents || [];
    const timezone = stats?.timezone;

    const recentActions: (RunHistoryAction & { timestamp: string; agentName: string })[] = stats?.recentActions
        ? stats.recentActions.map((action) => ({
            action: action.action,
            integration: action.integration as IntegrationType,
            target: action.target,
            details: action.details,
            url: action.url,
            timestamp: formatRelativeTime(action.timestamp),
            agentName: action.agentName,
            type: action.type,
        }))
        : [];

    return (
        <div className="mx-auto p-8 space-y-8">
            <StatsMetricsSection isLoading={isLoadingStats} metrics={metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DailyEventsChart eventsPerDay={eventsPerDay} timezone={timezone} />
                <RecentActionsSection recentActions={recentActions} />
            </div>

            <RecentAgentsSection
                isLoading={isLoadingAgents}
                agents={recentAgents}
            />
        </div>
    );
}

export default Home;

