import { useEffect } from "react";
import { SlackChannel } from "../shared/types";
import { RefreshButton } from "./RefreshButton";
import { useSlackChannels } from "@/hooks/api/useSlackChannels";
import { capitalize } from "../lib/utils";
import { useSlackUsers } from "../hooks/api/useSlackUsers";
import { MultiSelect } from "./MultiSelect";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "./ui/select";

interface SlackChannelSelectorProps {
    integrationId: string;
    selectedChannelId: string;
    listenToUserDms?: boolean;
    selectedUserIds?: string[];
    showListenToDMsOption?: boolean; // Only show DM option for user tokens
    showUserFilter?: boolean; // Only show user filter for user tokens
    onSelectChannel: (channelId: string, channelName?: string) => void;
    onListenToUserDmsChange: (listenToUserDms: boolean) => void;
    onSelectUsers: (userIds: string[]) => void;
}

export function SlackConfigurationSelector({
    integrationId,
    selectedChannelId,
    listenToUserDms = false,
    selectedUserIds = [],
    showListenToDMsOption = false,
    showUserFilter = false,
    onSelectChannel: onSelect,
    onListenToUserDmsChange,
    onSelectUsers
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

    const {
        users,
        isLoading: usersLoading,
        isError: usersIsError,
        error: usersError,
        isValidating: usersIsValidating,
        mutate: usersMutate,    
    } = useSlackUsers(showUserFilter ? integrationId : null);

    const errorMessage = isError ? error || 'Failed to load channels' : (showUserFilter && usersIsError) ? usersError || 'Failed to load users' : null;

    // Clear listenToUserDms if it's enabled but the option is not available (switched to bot token)
    useEffect(() => {
        if (!showListenToDMsOption && listenToUserDms && onListenToUserDmsChange) {
            onListenToUserDmsChange(false);
        }
    }, [showListenToDMsOption, listenToUserDms, onListenToUserDmsChange]);

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

    const handleChannelsRefresh = () => {
        void mutate();
    };

    const handleUsersRefresh = () => {
        void usersMutate();
    };


    const handleChannelSelect = (value: string) => {
        if (!value) {
            // If clearing selection, just call onSelect with empty values
            onSelect('', undefined);
            return;
        }
        
        // Special value for DMs
        if (value === '__LISTEN_TO_DMS__') {
            // Clear channel selection when enabling DMs
            onSelect('', undefined);
            if (onListenToUserDmsChange) {
                onListenToUserDmsChange(true);
            }
            return;
        }
        
        const selectedChannel = channels.find(ch => ch.id === value);
        if (selectedChannel) {
            // Clear listenToUserDms when selecting a channel
            if (listenToUserDms && onListenToUserDmsChange) {
                onListenToUserDmsChange(false);
            }
            onSelect(selectedChannel.id, selectedChannel.name);
        }
    };
    
    // Get the current select value (channel ID or special DM value)
    const getSelectValue = () => {
        if (listenToUserDms) {
            return '__LISTEN_TO_DMS__';
        }
        return selectedChannelId || '';
    };

    if (isLoading || (showUserFilter && usersLoading)) {
        return (
            <div className="text-sm text-[theme(text-secondary)]">
                Loading...
            </div>
        );
    }

    if (errorMessage) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-red-600">{String(errorMessage)}</div>
                <RefreshButton
                    onClick={handleChannelsRefresh}
                    isRefreshing={false}
                    label="Try again"
                    variant="link"
                    size="sm"
                    className="h-auto px-0 text-xs text-[theme(--color-accent)]"
                />
            </div>
        );
    }

    if (!listenToUserDms && channels.length === 0) {
        return (
            <div className="text-sm text-[theme(text-secondary)]">
                No channels found. Make sure your Slack app has been added to the channels you want to use.
            </div>
        );
    }

    if (showUserFilter && listenToUserDms && users.length === 0) {
        return (
            <div className="text-sm text-[theme(text-secondary)]">
                No users found. Unable to load users from this Slack workspace.
            </div>
        );
    }

    const publicChannels = channels.filter(ch => !ch.isPrivate && !ch.isArchived);
    const privateChannels = channels.filter(ch => ch.isPrivate && !ch.isArchived);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[theme(text-secondary)]">
                    Select Channel or DMs
                </label>
                <RefreshButton
                    onClick={handleChannelsRefresh}
                    isRefreshing={isValidating && !isLoading}
                    title="Refresh channel list"
                />
            </div>
            
            <Select
                value={getSelectValue()}
                onValueChange={handleChannelSelect}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="-- Select a channel or DMs --" />
                </SelectTrigger>
                <SelectContent>
                    {publicChannels.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Public Channels</SelectLabel>
                            {publicChannels.map((channel) => (
                                <SelectItem key={channel.id} value={channel.id}>
                                    #{channel.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                    {privateChannels.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Private Channels</SelectLabel>
                            {privateChannels.map((channel) => (
                                <SelectItem key={channel.id} value={channel.id}>
                                    {channel.isPrivate ? '🔒 ' : ''}{channel.isMPIM ? formatMPIMChannelName(channel.name) : channel.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                    {showListenToDMsOption && (
                        <>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel>Direct Messages</SelectLabel>
                                <SelectItem value="__LISTEN_TO_DMS__">
                                    Monitor private direct messages
                                </SelectItem>
                            </SelectGroup>
                        </>
                    )}
                </SelectContent>
            </Select>
            {channels.length > 0 && (
                <div className="text-xs text-foreground-muted">
                    {channels.length} channel{channels.length !== 1 ? 's' : ''} available
                </div>
            )}

            {/* User selector - show for both channels and DMs, but only for user tokens */}
            {showUserFilter && (selectedChannelId || listenToUserDms) && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-[theme(text-secondary)]">
                            Filter by Users (Optional)
                        </label>
                        <RefreshButton
                            onClick={handleUsersRefresh}
                            isRefreshing={usersIsValidating && !usersLoading}
                            title="Refresh user list"
                        />
                    </div>
                    <MultiSelect
                        options={users.map((user) => ({
                            id: user.id,
                            label: user.name,
                        }))}
                        selectedIds={selectedUserIds}
                        onSelect={(ids) => {
                            onSelectUsers?.(ids as string[])
                        }}
                        placeholder="Select users (optional)..."
                        searchPlaceholder="Search users..."
                        emptyMessage="No users found."
                        displayText={(count, selected) =>
                            count === 0
                                ? "Select users..."
                                : count === 1
                                ? selected[0].label
                                : `${count} users selected`
                        }
                    />
                    {users.length > 0 && (
                        <div className="text-xs text-foreground-muted">
                            {selectedUserIds.length > 0 
                                ? `${selectedUserIds.length} of ${users.length} user${users.length !== 1 ? 's' : ''} selected`
                                : `${users.length} user${users.length !== 1 ? 's' : ''} available`
                            }
                        </div>
                    )}
                </div>
            )}
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