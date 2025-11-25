import { useRecentChannels } from "../../hooks/api/useRecentChannels";
import { useStats } from "../../hooks/api/useStats";
import { formatRelativeTime } from "../../utility/timeUtils";
import { RecentAction } from "../../shared/types";
import { StatsMetricsSection } from "./components/StatsMetricsSection";
import { DailyEventsChart } from "./components/DailyEventsChart";
import { RecentActionsSection } from "./components/RecentActionsSection";
import { RecentChannelsSection } from "./components/RecentChannelsSection";
import { transformStatsToMetrics } from "./utils";

function Home() {
    const { channels: recentChannelsData, isLoading: isLoadingChannels } = useRecentChannels(3);
    const { stats, isLoading: isLoadingStats } = useStats();

    const metrics = transformStatsToMetrics(stats);

    const recentChannels = recentChannelsData.map(channel => ({
        ...channel,
        lastEdited: formatRelativeTime(channel.updatedAt),
        lastEventProcessedAt: channel.lastEventProcessedAt
            ? formatRelativeTime(channel.lastEventProcessedAt)
            : "Never",
    }));

    const eventsPerDay = stats?.dailyEvents || [];

    const recentActions: RecentAction[] = stats?.recentActions
        ? stats.recentActions.map((action) => ({
              ...action,
              timestamp: formatRelativeTime(action.timestamp),
          }))
        : [];

    return (
        <div className="mx-auto p-8 space-y-8">
            <StatsMetricsSection isLoading={isLoadingStats} metrics={metrics} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DailyEventsChart eventsPerDay={eventsPerDay} />
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

