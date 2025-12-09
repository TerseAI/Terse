import { useRecentChannels } from "../../hooks/api/useRecentChannels";
import { useStats } from "../../hooks/api/useStats";
import { formatRelativeTime } from "../../utility/timeUtils";
import { IntegrationType } from "../../shared/Integrations";
import { RunHistoryAction } from "../../shared/RunHistoryTypes";
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
    const timezone = stats?.timezone;

    const recentActions: (RunHistoryAction & { timestamp: string; channelName: string })[] = stats?.recentActions
        ? stats.recentActions.map((action) => ({
            action: action.action,
            integration: action.integration as IntegrationType,
            target: action.target,
            details: action.details,
            url: action.url,
            timestamp: formatRelativeTime(action.timestamp),
            channelName: action.channelName,
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

