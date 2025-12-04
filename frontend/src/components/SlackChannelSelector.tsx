import { useEffect, useMemo} from "react";
import { SlackChannel} from "../shared/types";
import { RefreshButton } from "./RefreshButton";
import { useSlackChannels } from "@/hooks/api/useSlackChannels";
import { capitalize } from "../lib/utils";

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
    const {
        channels,
        selectedChannelId: defaultChannelId,
        isLoading,
        isError,
        error,
        isValidating,
        mutate,
    } = useSlackChannels(integrationId);

    const isRefreshing = isValidating && !isLoading;
    const errorMessage = useMemo(() => {
        if (!isError) {
            return null;
        }
        if (error instanceof Error) {
            return error.message;
        }
        if (typeof error === 'string') {
            return error;
        }
        return 'Failed to load channels';
    }, [error, isError]);

    useEffect(() => {
        if (!integrationId || isLoading || channels.length === 0 || listenToUserDms) {
            return;
        }

        if (selectedChannelId) {
            return;
        }

        let channelToSelect: SlackChannel | undefined;

        if (defaultChannelId) {
            channelToSelect = channels.find((ch) => ch.id === defaultChannelId);
        }

        if (!channelToSelect) {
            channelToSelect = channels.find((ch) => !ch.isPrivate && !ch.isArchived);
        }

        if (!channelToSelect) {
            channelToSelect = channels.find((ch) => !ch.isArchived);
        }

        if (!channelToSelect) {
            channelToSelect = channels[0];
        }

        if (channelToSelect) {
            onSelect(channelToSelect.id, channelToSelect.name);
        }
    }, [channels, defaultChannelId, integrationId, isLoading, listenToUserDms, onSelect, selectedChannelId]);

    const handleRefresh = () => {
        void mutate();
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

    if (errorMessage) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-red-600">{errorMessage}</div>
                <RefreshButton
                    onClick={handleRefresh}
                    isRefreshing={false}
                    label="Try again"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs text-[theme(--color-accent)]"
                />
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
                <RefreshButton
                    onClick={handleRefresh}
                    isRefreshing={isRefreshing}
                    title="Refresh channel list"
                />
            </div>
            
            <select
                value={selectedChannelId || ''}
                onChange={(e) => handleChannelSelect(e.target.value)}
                disabled={listenToUserDms}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="text-xs text-foreground-muted">
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
                    className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <span className="text-sm text-[theme(text-primary)]">
                    Monitor all private direct messages
                </span>
            </label>
        </div>
    );
}



// Format MPIM channel names from "mpdm-olivier--thomas--zapier-1" to "Olivier, Thomas, Zapier..."
export const formatMPIMChannelName = (name: string): string => {
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
    const formattedNames = names.map(capitalize);
    
    // Add "..." if there are more than 3 names
    const suffix = totalNames > 3 ? '...' : '';
    
    return formattedNames.join(', ') + suffix;
};