import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { SlackChannel, SlackChannelsResponse } from "../shared/types";
import { RotateCw } from "lucide-react";

interface SlackChannelSelectorProps {
    integrationId: string;
    selectedChannelId?: string;
    onSelect: (channelId: string, channelName?: string) => void;
}

export function SlackChannelSelector({
    integrationId,
    selectedChannelId,
    onSelect
}: SlackChannelSelectorProps) {
    const [channels, setChannels] = useState<SlackChannel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchChannels = async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const response: SlackChannelsResponse = await BackendProvider.getSlackChannels(integrationId);
            setChannels(response.channels);

            // Only auto-select if no channel is currently selected and we have channels
            if (!selectedChannelId && response.channels.length > 0) {
                // Prefer non-private, non-archived channels
                let channelToSelect = response.channels.find(
                    ch => !ch.isPrivate && !ch.isArchived
                );
                // Fall back to first available channel
                if (!channelToSelect) {
                    channelToSelect = response.channels.find(ch => !ch.isArchived);
                }
                // Last resort: any channel
                if (!channelToSelect && response.channels.length > 0) {
                    channelToSelect = response.channels[0];
                }

                if (channelToSelect) {
                    onSelect(channelToSelect.id, channelToSelect.name);
                }
            }
        } catch (err: any) {
            console.error('Error fetching Slack channels:', err);
            setError(err.message || 'Failed to load channels');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (integrationId) {
            fetchChannels();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [integrationId]);

    const handleRefresh = () => {
        fetchChannels(true);
    };

    if (isLoading) {
        return (
            <div className="text-sm text-[theme(text-secondary)]">
                Loading channels...
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-red-600">{error}</div>
                <button
                    onClick={handleRefresh}
                    className="text-xs text-[theme(--color-accent)] hover:underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    if (channels.length === 0) {
        return (
            <div className="text-sm text-[theme(text-secondary)]">
                No channels found. Make sure your Slack app has been added to the channels you want to use.
            </div>
        );
    }

    const publicChannels = channels.filter(ch => !ch.isPrivate && !ch.isArchived);
    const privateChannels = channels.filter(ch => ch.isPrivate && !ch.isArchived);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[theme(text-secondary)]">
                    Select Channel
                </label>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="flex items-center gap-1 text-xs text-[theme(--color-accent)] hover:underline disabled:opacity-50"
                    title="Refresh channel list"
                >
                    <RotateCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>
            <select
                value={selectedChannelId || ''}
                onChange={(e) => {
                    const selectedChannel = channels.find(ch => ch.id === e.target.value);
                    if (selectedChannel) {
                        onSelect(selectedChannel.id, selectedChannel.name);
                    }
                }}
                className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)]"
            >
                {!selectedChannelId && (
                    <option value="">-- Select a channel --</option>
                )}
                {publicChannels.length > 0 && (
                    <optgroup label="Public Channels">
                        {publicChannels.map((channel) => (
                            <option key={channel.id} value={channel.id}>
                                #{channel.name}
                            </option>
                        ))}
                    </optgroup>
                )}
                {privateChannels.length > 0 && (
                    <optgroup label="Private Channels & DMs">
                        {privateChannels.map((channel) => (
                            <option key={channel.id} value={channel.id}>
                                {channel.isPrivate ? '🔒 ' : ''}{channel.name}
                            </option>
                        ))}
                    </optgroup>
                )}
            </select>
            {channels.length > 0 && (
                <div className="text-xs text-[theme(text-secondary)]">
                    {channels.length} channel{channels.length !== 1 ? 's' : ''} available
                </div>
            )}
        </div>
    );
}

