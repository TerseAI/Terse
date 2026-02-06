import { useEffect } from "react"

import { Info } from "lucide-react"

import { useSlackChannels } from "@/hooks/api/useSlackChannels"

import { useSlackUsers } from "../hooks/api/useSlackUsers"
import { capitalize } from "../lib/utils"

import { MultiSelect } from "./MultiSelect"
import { RefreshButton } from "./RefreshButton"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "./ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

interface SlackChannelSelectorProps {
    integrationId: string
    selectedChannelId: string
    listenToUserDms?: boolean
    selectedUserIds?: string[]
    showListenToDMsOption?: boolean // Show DM option (for triggers: only user tokens; for output: both)
    showUserFilter?: boolean // Show user list (for triggers: only user tokens; for output: both)
    isBotToken?: boolean // Whether this is a bot token (vs user token)
    mode?: "trigger" | "output" // For output: DM label is "Send to direct messages" and users required when DMs selected
    onSelectChannel: (channelId: string, agentName?: string) => void
    onListenToUserDmsChange: (listenToUserDms: boolean) => void
    onSelectUsers: (userIds: string[]) => void
}

export function SlackConfigurationSelector({
    integrationId,
    selectedChannelId,
    listenToUserDms = false,
    selectedUserIds = [],
    showListenToDMsOption = false,
    showUserFilter = false,
    isBotToken = true, // Default to true (bot) for backward compatibility
    mode = "trigger",
    onSelectChannel: onSelect,
    onListenToUserDmsChange,
    onSelectUsers
}: SlackChannelSelectorProps) {
    const { channels, isLoading, isError, error, isValidating, mutate } = useSlackChannels(integrationId)

    const { users, isLoading: usersLoading, isError: usersIsError, error: usersError, isValidating: usersIsValidating, mutate: usersMutate } = useSlackUsers(showUserFilter ? integrationId : null)

    const errorMessage = isError ? error || "Failed to load channels" : showUserFilter && usersIsError ? usersError || "Failed to load users" : null

    // Clear listenToUserDms if it's enabled but the option is not available (switched to bot token)
    useEffect(() => {
        if (!showListenToDMsOption && listenToUserDms && onListenToUserDmsChange) {
            onListenToUserDmsChange(false)
        }
    }, [showListenToDMsOption, listenToUserDms, onListenToUserDmsChange])

    const handleChannelsRefresh = () => {
        void mutate()
    }

    const handleUsersRefresh = () => {
        void usersMutate()
    }

    const handleChannelSelect = (value: string) => {
        if (!value) {
            // If clearing selection, just call onSelect with empty values
            onSelect("", undefined)
            return
        }

        // Special value for DMs
        if (value === "__LISTEN_TO_DMS__") {
            // Clear channel selection when enabling DMs
            onSelect("", undefined)
            if (onListenToUserDmsChange) {
                onListenToUserDmsChange(true)
            }
            return
        }

        const selectedChannel = channels.find(ch => ch.id === value)
        if (selectedChannel) {
            // Clear listenToUserDms when selecting a channel
            if (listenToUserDms && onListenToUserDmsChange) {
                onListenToUserDmsChange(false)
            }
            onSelect(selectedChannel.id, selectedChannel.name)
        }
    }

    // Get the current select value (channel ID or special DM value)
    const getSelectValue = () => {
        if (listenToUserDms) {
            return "__LISTEN_TO_DMS__"
        }
        return selectedChannelId || ""
    }

    if (isLoading || (showUserFilter && usersLoading)) {
        return <div className="text-sm text-[theme(text-secondary)]">Loading...</div>
    }

    if (errorMessage) {
        return (
            <div className="space-y-2">
                <div className="text-sm text-red-600">{String(errorMessage)}</div>
                <RefreshButton onClick={handleChannelsRefresh} isRefreshing={false} label="Try again" variant="link" size="sm" className="h-auto px-0 text-xs text-[theme(--color-accent)]" />
            </div>
        )
    }

    // Only show "No channels found" if DM option is not available (bot tokens)
    // For user tokens, we should still show the Select dropdown so users can enable DM listening
    if (!listenToUserDms && channels.length === 0 && !showListenToDMsOption) {
        return (
            <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-md border border-border">
                <p className="text-sm text-muted-foreground">No channels available yet. You need to invite the Terse bot to channels before they'll appear here.</p>
                <p className="text-sm text-muted-foreground">
                    In Slack, go to a channel and type <code className="px-1.5 py-0.5 bg-muted rounded text-foreground">/invite @Terse</code> to add the bot, then refresh this list.
                </p>
            </div>
        )
    }

    const publicChannels = channels.filter(ch => !ch.isPrivate && !ch.isArchived)
    const privateChannels = channels.filter(ch => ch.isPrivate && !ch.isArchived)

    const isOutputMode = mode === "output"
    const needsUsersForDms = isOutputMode && listenToUserDms && (selectedUserIds?.length ?? 0) === 0
    const isIncomplete = !selectedChannelId && !listenToUserDms ? true : needsUsersForDms

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-[theme(text-secondary)]">
                        Select Channel or DMs
                        <span className="text-red-500 ml-1">*</span>
                    </label>
                    {isBotToken && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" onClick={e => e.preventDefault()}>
                                    <Info className="w-3.5 h-3.5" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                                <p>
                                    Only channels where you've added the Terse bot will appear here. To add a channel, go to that channel in Slack and type{" "}
                                    <code className="px-1 py-0.5 bg-muted rounded text-xs">/invite @Terse</code>
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <RefreshButton onClick={handleChannelsRefresh} isRefreshing={isValidating && !isLoading} title="Refresh channel list" />
            </div>

            <Select value={getSelectValue()} onValueChange={handleChannelSelect}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a channel or direct messages" />
                </SelectTrigger>
                <SelectContent>
                    {publicChannels.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Public Channels</SelectLabel>
                            {publicChannels.map(channel => (
                                <SelectItem key={channel.id} value={channel.id}>
                                    #{channel.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                    {privateChannels.length > 0 && (
                        <SelectGroup>
                            <SelectLabel>Private Channels</SelectLabel>
                            {privateChannels.map(channel => (
                                <SelectItem key={channel.id} value={channel.id}>
                                    {channel.isPrivate ? "🔒 " : ""}
                                    {channel.isMPIM ? formatMPIMChannelName(channel.name) : channel.name}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    )}
                    {showListenToDMsOption && (
                        <>
                            <SelectSeparator />
                            <SelectGroup>
                                <SelectLabel>Direct Messages</SelectLabel>
                                <SelectItem value="__LISTEN_TO_DMS__">{mode === "output" ? "Send to direct messages" : "Monitor direct messages"}</SelectItem>
                            </SelectGroup>
                        </>
                    )}
                </SelectContent>
            </Select>
            {channels.length > 0 && (
                <div className="text-xs text-foreground-muted">
                    {channels.length} channel{channels.length !== 1 ? "s" : ""} available
                </div>
            )}
            {isIncomplete && needsUsersForDms && <p className="text-xs text-muted-foreground">Select at least one user to send DMs to.</p>}

            {/* User selector - for triggers: optional filter "DMs from these users only"; for output: required when "Send to DMs" selected */}
            {showUserFilter && (selectedChannelId || listenToUserDms) && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-[theme(text-secondary)]">
                            {mode === "output" && listenToUserDms ? "Select Users (Required)" : listenToUserDms ? "Only DMs from these users (optional)" : "Select Users (Optional)"}
                        </label>
                        <RefreshButton onClick={handleUsersRefresh} isRefreshing={usersIsValidating && !usersLoading} title="Refresh user list" />
                    </div>
                    <MultiSelect
                        options={users.map(user => ({
                            id: user.id,
                            label: user.name
                        }))}
                        selectedIds={selectedUserIds}
                        onSelect={ids => {
                            onSelectUsers?.(ids as string[])
                        }}
                        placeholder={
                            mode === "output" && listenToUserDms ? "Select users to send DMs to..." : listenToUserDms ? "All DMs (leave empty) or select users..." : "Select users (optional)..."
                        }
                        searchPlaceholder="Search users..."
                        emptyMessage="No users found."
                        displayText={(count, selected) => (count === 0 ? "Select users..." : count === 1 ? selected[0].label : `${count} users selected`)}
                    />
                    {listenToUserDms && mode === "trigger" && (
                        <p className="text-xs text-muted-foreground">Leave empty to trigger on all DMs. Select users to only trigger when those users send a direct message.</p>
                    )}
                    {users.length > 0 && (
                        <div className="text-xs text-foreground-muted">
                            {selectedUserIds.length > 0
                                ? `${selectedUserIds.length} of ${users.length} user${users.length !== 1 ? "s" : ""} selected`
                                : `${users.length} user${users.length !== 1 ? "s" : ""} available`}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// Format MPIM channel names from "mpdm-olivier--thomas--zapier-1" to "Olivier, Thomas, Zapier..."
export const formatMPIMChannelName = (name: string): string => {
    if (!name.startsWith("mpdm-")) {
        return name
    }

    // Remove "mpdm-" prefix and split by double hyphens (--)
    const namePart = name.slice(5)
    const parts = namePart.split("--")

    // Remove number suffix from the last part if it exists (e.g., "zapier-1" -> "zapier")
    if (parts.length > 0) {
        const lastPart = parts[parts.length - 1]
        // Check if last part ends with a number suffix (e.g., "-1", "-2")
        const numberSuffixMatch = lastPart.match(/^(.+)-\d+$/)
        if (numberSuffixMatch) {
            parts[parts.length - 1] = numberSuffixMatch[1]
        }
    }

    // Store the total number of name parts before slicing
    const totalNames = parts.length

    // Take first 3 names (or all if less than 3)
    const names = parts.slice(0, 3)

    // Capitalize first letter of each name and join with commas
    const formattedNames = names.map(capitalize)

    // Add "..." if there are more than 3 names
    const suffix = totalNames > 3 ? "..." : ""

    return formattedNames.join(", ") + suffix
}
