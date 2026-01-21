import { useRecentChannels } from "../../hooks/api/useRecentChannels";
import { useStats } from "../../hooks/api/useStats";
import { useChannels } from "../../hooks/api/useChannels";
import { formatRelativeTime } from "../../utility/timeUtils";
import { IntegrationType } from "../../shared/Integrations";
import { RunHistoryAction } from "../../shared/RunHistoryTypes";
import { StatsMetricsSection } from "./components/StatsMetricsSection";
import { DailyEventsChart } from "./components/DailyEventsChart";
import { RecentActionsSection } from "./components/RecentActionsSection";
import { RecentChannelsSection } from "./components/RecentChannelsSection";
import { HomeEmptyState } from "./components/HomeEmptyState";
import { transformStatsToMetrics } from "./utils";

function Home() {
    const { channels: allChannels, isLoading: isLoadingAllChannels } = useChannels({ limit: 1 });
    const { channels: recentChannelsData, isLoading: isLoadingChannels } = useRecentChannels(3);
    const { stats, isLoading: isLoadingStats } = useStats();

    const hasNoChannels = !isLoadingAllChannels && allChannels.length === 0;

    // Show empty state if user has no channels
    if (hasNoChannels) {
        return <HomeEmptyState />;
    }

    const metrics = transformStatsToMetrics(stats);

    const recentChannels = recentChannelsData.map(channel => ({
        ...channel,
        lastEdited: formatRelativeTime(channel.updatedAt),
        lastEventProcessedAt: channel.lastEventProcessedAt
            ? formatRelativeTime(channel.lastEventProcessedAt)
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

            <RecentChannelsSection
                isLoading={isLoadingChannels}
                channels={recentChannels}
            />
        </div>
    );
}

export default Home;

