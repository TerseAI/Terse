import { useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { SlackChannel, SlackChannelsResponse } from "../shared/types";
import { RefreshCw } from "lucide-react";
import { Button } from "./ui/button";

interface SlackChannelSelectorProps {
    integrationId: string;
    selectedChannelId?: string;
    listenToUserDms?: boolean;
    onSelect: (channelId: string, channelName?: string) => void;
    onListenToUserDmsChange?: (listenToUserDms: boolean) => void;
}

export function SlackChannelSelector({
    integrationId,
    selectedChannelId,
    listenToUserDms = false,
    onSelect,
    onListenToUserDmsChange
}: SlackChannelSelectorProps) {
    const [channels, setChannels] = useState<SlackChannel[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Format MPIM channel names from "mpdm-olivier--thomas--zapier-1" to "Olivier, Thomas, Zapier..."
    const formatMPIMChannelName = (name: string): string => {
        if (!name.startsWith('mpdm-')) {
            return name;
        }
        
        // Remove "mpdm-" prefix and split by double hyphens (--)
        const namePart = name.slice(5);
        const parts = namePart.split('--');
        
        // Remove number suffix from the last part if it exists (e.g., "zapier-1" -> "zapier")
        if (parts.length > 0) {
            const lastPart = parts[parts.length - 1];
            // Check if last part ends with a number suffix (e.g., "-1", "-2")
            const numberSuffixMatch = lastPart.match(/^(.+)-\d+$/);
            if (numberSuffixMatch) {
                parts[parts.length - 1] = numberSuffixMatch[1];
            }
        }
        
        // Store the total number of name parts before slicing
        const totalNames = parts.length;
        
        // Take first 3 names (or all if less than 3)
        const names = parts.slice(0, 3);
        
        // Capitalize first letter of each name and join with commas
        const formattedNames = names.map(namePart => 
            namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase()
        );
        
        // Add "..." if there are more than 3 names
        const suffix = totalNames > 3 ? '...' : '';
        
        return formattedNames.join(', ') + suffix;
    };

    const fetchChannels = async (isRefresh = false) => {
        if (isRefresh) {
            setIsRefreshing(true);
        } else {
            setIsLoading(true);
        }
        setError(null);

        try {
            const response: SlackChannelsResponse = await BackendProvider.getSlackChannels(
                integrationId,
                isRefresh ? { forceRefresh: true } : undefined
            );
            setChannels(response.channels);

            // Only auto-select if no channel is currently selected, listenToUserDms is false, and we have channels
            if (!selectedChannelId && !listenToUserDms && response.channels.length > 0) {
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

    const handleListenToUserDmsChange = (checked: boolean) => {
        if (checked) {
            // Clear channel selection when enabling DMs
            onSelect('', undefined);
        }
        onListenToUserDmsChange?.(checked);
    };

    const handleChannelSelect = (channelId: string) => {
        if (!channelId) {
            // If clearing selection, just call onSelect with empty values
            onSelect('', undefined);
            return;
        }
        
        const selectedChannel = channels.find(ch => ch.id === channelId);
        if (selectedChannel) {
            // Clear listenToUserDms when selecting a channel
            if (listenToUserDms && onListenToUserDmsChange) {
                onListenToUserDmsChange(false);
            }
            onSelect(selectedChannel.id, selectedChannel.name);
        }
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
            {!listenToUserDms &&
            <>
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[theme(text-secondary)]">
                    Select Channel
                </label>
                <Button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    variant="ghost"
                    size="sm"
                    title="Refresh channel list"
                >
                    <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            
            <select
                value={selectedChannelId || ''}
                onChange={(e) => handleChannelSelect(e.target.value)}
                disabled={listenToUserDms}
                className="w-full px-3 py-2 text-sm border border-[theme(border)] rounded-lg bg-[theme(background)] text-[theme(text-primary)] focus:outline-none focus:ring-2 focus:ring-[theme(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <optgroup label="Private Channels">
                        {privateChannels.map((channel) => (
                            <option key={channel.id} value={channel.id}>
                                {channel.isPrivate ? '🔒 ' : ''}{channel.isMPIM ? formatMPIMChannelName(channel.name) : channel.name}
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
            </>}

            {/* Listen to user DMs checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
                <input
                    type="checkbox"
                    checked={listenToUserDms}
                    onChange={(e) => handleListenToUserDmsChange(e.target.checked)}
                    className="w-4 h-4 rounded border-[theme(border)] text-[theme(--color-accent)] focus:ring-2 focus:ring-[theme(--color-accent)] cursor-pointer"
                />
                <span className="text-sm text-[theme(text-primary)]">
                    Monitor all private direct messages
                </span>
            </label>
        </div>
    );
}

