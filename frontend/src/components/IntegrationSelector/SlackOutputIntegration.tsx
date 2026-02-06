import { useState } from "react"

import { AlertTriangleIcon, Hash, MessageSquare, Plus } from "lucide-react"

import { useSlackChannels } from "@/hooks/api/useSlackChannels"
import { useSlackIntegrations } from "@/hooks/api/useSlackIntegrations"
import { useSlackUsers } from "@/hooks/api/useSlackUsers"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"
import { SlackChannel } from "@/shared/types"

import { IconForConfigType } from "../../pages/Agents/components/Integration"
import { ConfigType, SlackOutputConfig } from "../../shared/Configs"
import { SlackConnectionOptions } from "../Integrations/helpers/SlackConnectionOptions"
import { RefreshButton } from "../RefreshButton"
import DropdownSelect from "../ui/DropdownSelect"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "../ui/select"

import { InputConfigSelectorProps } from "./types"

export function SlackOutputIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations()
    const currentConfig = input.config as SlackOutputConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.SLACK_OUTPUT)

    // Connection options
    const [showConnectionOptions, setShowConnectionOptions] = useState(false)
    const [isBotUser, setIsBotUser] = useState(true)

    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.SLACK>(IntegrationType.SLACK, { isBotUser })

    // Fetch channels with DMs included for output selection
    const { channels, isLoading: channelsLoading, isError: channelsError, error: channelsErrorMsg, isValidating, mutate } = useSlackChannels(selectedIntegrationId)

    // Fetch users for DM selection
    const { users, isLoading: usersLoading, isValidating: usersIsValidating, mutate: usersMutate } = useSlackUsers(selectedIntegrationId)

    const handleConnect = async () => {
        await connectOAuth()
        setShowConnectionOptions(false)
    }

    function onSelectIntegration(value: string) {
        const integration = integrations.find((integration: SlackIntegrationType) => integration.id === value)
        if (integration) {
            setSelectedIntegrationId(integration.id)
            // Clear channel and user selection when switching integrations
            const config = new SlackOutputConfig(integration.id, undefined, undefined, undefined, undefined)
            setConfig(config)
        }
    }

    function onSelectDestination(value: string) {
        if (!selectedIntegrationId) return

        // Check if this is a user selection (prefixed with "user:")
        if (value.startsWith("user:")) {
            const userId = value.substring(5)
            const selectedUser = users.find(u => u.id === userId)
            if (selectedUser) {
                // Create config with userId for DM, clearing channelId
                const config = new SlackOutputConfig(selectedIntegrationId, undefined, undefined, selectedUser.id, selectedUser.name)
                setConfig(config)
            }
            return
        }

        // Otherwise it's a channel selection
        const selectedChannel = channels.find(ch => ch.id === value)
        if (selectedChannel) {
            // Create config with channelId, clearing userId
            const config = new SlackOutputConfig(selectedIntegrationId, selectedChannel.id, selectedChannel.name, undefined, undefined)
            setConfig(config)
        }
    }

    function onClickConnect() {
        setShowConnectionOptions(true)
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        )
    }

    if (showConnectionOptions) {
        return <SlackConnectionOptions isBotUser={isBotUser} setIsBotUser={setIsBotUser} onBack={() => setShowConnectionOptions(false)} onConnect={handleConnect} isConnecting={isOAuthConnecting} />
    }

    if (integrations.length === 0) {
        if (variant === "card") {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Slack
                </div>
            )
        }
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No Slack accounts connected</div>
                <Button onClick={onClickConnect} disabled={isOAuthConnecting}>
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? "Connecting..." : `Connect Slack`}
                </Button>
            </div>
        )
    }

    const connectionSelections = integrations.map((integration: SlackIntegrationType) => ({
        label: `${integration.teamName || "Unknown Workspace"}${integration.isBotUser === false ? " - User" : " - Bot"}`,
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === currentConfig?.integrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length === 1) {
        const defaultIntegration = connectionSelections[0]
        setSelectedIntegrationId(defaultIntegration.value)
        setConfig(new SlackOutputConfig(defaultIntegration.value, currentConfig?.channelId, currentConfig?.channelName, currentConfig?.userId, currentConfig?.userName))
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    // Card variant: compact view
    if (variant === "card") {
        const hasConfig = !!currentConfig && !!currentConfig.integrationId
        const needsDestination = !currentConfig?.channelId && !currentConfig?.userId
        const isComplete = hasConfig && !needsDestination
        if (!isComplete) {
            if (!hasConfig) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Configure
                    </div>
                )
            }
            if (needsDestination) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Select destination
                    </div>
                )
            }
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Configure
                </div>
            )
        }
        // Show DM icon for user destinations, hash for channels
        if (currentConfig?.userId) {
            return (
                <div className="text-sm flex items-center gap-1">
                    <MessageSquare className="w-3 h-3 text-muted-foreground" />
                    DM: {currentConfig?.userName || currentConfig?.userId}
                </div>
            )
        }
        return (
            <div className="text-sm flex items-center gap-1">
                <Hash className="w-3 h-3 text-muted-foreground" />
                {currentConfig?.channelName || selectedOption?.label || "No connection selected"}
            </div>
        )
    }

    // Group channels for display
    const publicChannels = channels.filter((ch: SlackChannel) => !ch.isPrivate && !ch.isArchived)
    const privateChannels = channels.filter((ch: SlackChannel) => ch.isPrivate && !ch.isArchived && !ch.isMPIM)
    const groupChannels = channels.filter((ch: SlackChannel) => ch.isMPIM && !ch.isArchived)

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3 min-w-0 overflow-hidden">
            <div className="flex flex-row gap-2 items-center">
                <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <IconForConfigType type={ConfigType.SLACK_OUTPUT} />
                </div>
                <div className="flex-1 min-w-0">
                    <DropdownSelect
                        statusOptions={connectionSelections}
                        selectedOption={selectedOption}
                        setSelected={onSelectIntegration}
                        placeholder="No connection selected"
                        additionalAction={{
                            label: "Connect Another Slack",
                            onClick: onClickConnect
                        }}
                    />
                </div>
            </div>

            {/* Destination selector (channels + DM users) */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border min-w-0 overflow-hidden">
                    {!currentConfig?.channelId && !currentConfig?.userId && <p className="text-sm text-muted-foreground mb-3">Select where Terse should send messages</p>}

                    {channelsLoading || usersLoading ? (
                        <div className="text-sm text-muted-foreground">Loading destinations...</div>
                    ) : channelsError ? (
                        <div className="space-y-2">
                            <div className="text-sm text-red-600">{String(channelsErrorMsg)}</div>
                            <RefreshButton onClick={() => mutate()} isRefreshing={false} label="Try again" variant="link" size="sm" className="h-auto px-0 text-xs" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-medium text-muted-foreground">Destination</label>
                                <RefreshButton
                                    onClick={() => {
                                        mutate()
                                        usersMutate()
                                    }}
                                    isRefreshing={(isValidating && !channelsLoading) || (usersIsValidating && !usersLoading)}
                                    title="Refresh destination list"
                                />
                            </div>

                            <Select value={currentConfig?.userId ? `user:${currentConfig.userId}` : currentConfig?.channelId || ""} onValueChange={onSelectDestination}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select a channel or user" />
                                </SelectTrigger>
                                <SelectContent>
                                    {publicChannels.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel>Public Channels</SelectLabel>
                                            {publicChannels.map((channel: SlackChannel) => (
                                                <SelectItem key={channel.id} value={channel.id}>
                                                    <span className="flex items-center gap-2">
                                                        <Hash className="w-3 h-3" />
                                                        {channel.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                    {privateChannels.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel>Private Channels</SelectLabel>
                                            {privateChannels.map((channel: SlackChannel) => (
                                                <SelectItem key={channel.id} value={channel.id}>
                                                    <span className="flex items-center gap-2">🔒 {channel.name}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                    {groupChannels.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel>Group Messages</SelectLabel>
                                            {groupChannels.map((channel: SlackChannel) => (
                                                <SelectItem key={channel.id} value={channel.id}>
                                                    <span className="flex items-center gap-2">👥 {channel.name}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                    {users.length > 0 && (
                                        <>
                                            <SelectSeparator />
                                            <SelectGroup>
                                                <SelectLabel>Direct Messages</SelectLabel>
                                                {users.map(user => (
                                                    <SelectItem key={user.id} value={`user:${user.id}`}>
                                                        <span className="flex items-center gap-2">
                                                            <MessageSquare className="w-3 h-3" />
                                                            {user.name}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>

                            {(channels.length > 0 || users.length > 0) && (
                                <div className="text-xs text-muted-foreground">
                                    {channels.length} channel{channels.length !== 1 ? "s" : ""}, {users.length} user{users.length !== 1 ? "s" : ""} available
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <Button onClick={onClickConnect} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Slack"}
            </Button>
        </div>
    )
}
