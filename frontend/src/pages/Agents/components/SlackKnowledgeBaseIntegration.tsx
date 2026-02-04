import { useState } from "react"

import { AlertTriangleIcon, Plus } from "lucide-react"

import { MultiSelect } from "@/components/MultiSelect"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useSlackChannels } from "@/hooks/api/useSlackChannels"
import { useSlackIntegrations } from "@/hooks/api/useSlackIntegrations"
import { useSlackUsers } from "@/hooks/api/useSlackUsers"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { SlackKBConfig } from "@/shared/Configs"
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"
import { SlackConnectionOptions } from "@/components/Integrations/helpers/SlackConnectionOptions"
import DropdownSelect, { StatusOption } from "@/components/ui/DropdownSelect"
import { Checkbox } from "@/components/ui/checkbox"

import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector"

export function SlackKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations()
    const [showConnectionOptions, setShowConnectionOptions] = useState(false)
    const [isBotUser, setIsBotUser] = useState(true)

    const slackConfig = (knowledgeBase.config as SlackKBConfig) || new SlackKBConfig("", [], [], false, [], [])
    const selectedIntegrationId = slackConfig.integrationId || null

    const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId)
    const hasUserToken = selectedIntegration?.isBotUser === false

    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.SLACK>(IntegrationType.SLACK, { isBotUser })

    const { channels, isLoading: channelsLoading } = useSlackChannels(selectedIntegrationId)
    const { users, isLoading: usersLoading } = useSlackUsers(hasUserToken ? selectedIntegrationId : null)

    const handleConnect = async () => {
        await connectOAuth()
        setShowConnectionOptions(false)
    }

    if (isLoading) {
        return <Skeleton className="h-20 w-full" />
    }

    // Card variant: compact view
    if (variant === "card") {
        if (integrations.length === 0) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Slack
                </div>
            )
        }
        if (!selectedIntegrationId) {
            return <div className="text-xs text-center text-muted-foreground">Select workspace</div>
        }
        const channelCount = slackConfig.channelIds?.length ?? 0
        const userCount = slackConfig.userIds?.length ?? 0
        const parts: string[] = []
        if (channelCount > 0) {
            parts.push(`${channelCount} channel${channelCount !== 1 ? "s" : ""}`)
        }
        if (hasUserToken && slackConfig.allowDms) {
            parts.push("DMs")
        }
        if (userCount > 0) {
            parts.push(`${userCount} user${userCount !== 1 ? "s" : ""}`)
        }
        // If no filters are set, show "All accessible"
        const displayText = parts.length > 0 ? parts.join(" + ") : "All accessible"
        return <div className="text-xs text-center">{displayText}</div>
    }

    // Connection options screen
    if (showConnectionOptions) {
        return (
            <SlackConnectionOptions
                isBotUser={isBotUser}
                setIsBotUser={setIsBotUser}
                onBack={() => setShowConnectionOptions(false)}
                onConnect={handleConnect}
                isConnecting={isOAuthConnecting}
            />
        )
    }

    // No integrations: show connect prompt
    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg border border-dashed border-input bg-card text-center">
                <div className="text-sm text-muted-foreground">No Slack accounts connected</div>
                <Button onClick={() => setShowConnectionOptions(true)} disabled={isOAuthConnecting}>
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? "Connecting..." : "Connect Slack"}
                </Button>
            </div>
        )
    }

    const updateIntegrationId = (integrationId: string) => {
        setConfig(new SlackKBConfig(integrationId, [], [], false, [], []))
    }

    const channelOptions = (channels ?? []).map(ch => ({
        id: ch.id,
        label: ch.isPrivate ? `🔒 ${ch.name}` : `#${ch.name}`
    }))

    const userOptions = (users ?? []).map(user => ({
        id: user.id,
        label: user.name
    }))

    const updateChannels = (selectedIds: (string | number)[]) => {
        const ids = selectedIds as string[]
        const names = ids
            .map(id => {
                const ch = channels?.find(c => c.id === id)
                return ch ? (ch.isPrivate ? ch.name : `#${ch.name}`) : null
            })
            .filter((n): n is string => n !== null)
        setConfig(new SlackKBConfig(slackConfig.integrationId, ids, names, slackConfig.allowDms, slackConfig.userIds, slackConfig.userNames))
    }

    const updateAllowDms = (allowDms: boolean) => {
        setConfig(new SlackKBConfig(slackConfig.integrationId, slackConfig.channelIds, slackConfig.channelNames, allowDms, slackConfig.userIds, slackConfig.userNames))
    }

    const updateUsers = (selectedIds: (string | number)[]) => {
        const ids = selectedIds as string[]
        const names = ids
            .map(id => {
                const user = users?.find(u => u.id === id)
                return user?.name ?? null
            })
            .filter((n): n is string => n !== null)
        setConfig(new SlackKBConfig(slackConfig.integrationId, slackConfig.channelIds, slackConfig.channelNames, slackConfig.allowDms, ids, names))
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: SlackIntegrationType) => ({
        label: `${integration.teamName || "Unknown Workspace"}${integration.isBotUser === false ? " - User" : " - Bot"}`,
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length === 1) {
        const defaultIntegration = connectionSelections[0]
        updateIntegrationId(defaultIntegration.value)
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    const hasFilters = (slackConfig.channelIds?.length ?? 0) > 0 || slackConfig.allowDms || (slackConfig.userIds?.length ?? 0) > 0

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <Label className="font-medium">Slack Workspace</Label>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={updateIntegrationId}
                    placeholder="No connection selected"
                />
            </div>

            <Button onClick={() => setShowConnectionOptions(true)} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Slack"}
            </Button>

            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border">
                    {!hasFilters && (
                        <p className="text-xs text-muted-foreground mb-4">
                            By default, the agent can search all channels it has access to. Use the filters below to restrict access to specific channels or users.
                        </p>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Filter by Channels (Optional)</Label>
                            <MultiSelect
                                options={channelOptions}
                                selectedIds={slackConfig.channelIds ?? []}
                                onSelect={updateChannels}
                                placeholder="All channels accessible..."
                                emptyMessage={channelsLoading ? "Loading..." : "No channels available. Invite the bot to channels first."}
                                displayText={(count, selected) => (count === 0 ? "All channels" : count === 1 ? selected[0].label : `${count} channels selected`)}
                            />
                            {channels && channels.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                    {slackConfig.channelIds?.length
                                        ? `${slackConfig.channelIds.length} of ${channels.length} channel${channels.length !== 1 ? "s" : ""} selected`
                                        : `${channels.length} channel${channels.length !== 1 ? "s" : ""} available`}
                                </div>
                            )}
                        </div>

                        {hasUserToken ? (
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="slack-kb-allow-dms"
                                    checked={slackConfig.allowDms}
                                    onCheckedChange={checked => updateAllowDms(checked === true)}
                                />
                                <Label htmlFor="slack-kb-allow-dms" className="text-sm font-normal cursor-pointer">
                                    Include DMs in search
                                </Label>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">This is a bot token. To search DMs, connect with a user token instead.</p>
                        )}

                        {/* User filter - only for user tokens */}
                        {hasUserToken && (
                            <div className="space-y-2">
                                <Label>Filter by Users (Optional)</Label>
                                <MultiSelect
                                    options={userOptions}
                                    selectedIds={slackConfig.userIds ?? []}
                                    onSelect={updateUsers}
                                    placeholder="All users..."
                                    searchPlaceholder="Search users..."
                                    emptyMessage={usersLoading ? "Loading..." : "No users found."}
                                    displayText={(count, selected) => (count === 0 ? "All users" : count === 1 ? selected[0].label : `${count} users selected`)}
                                />
                                {users && users.length > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                        {slackConfig.userIds?.length
                                            ? `${slackConfig.userIds.length} of ${users.length} user${users.length !== 1 ? "s" : ""} selected`
                                            : `${users.length} user${users.length !== 1 ? "s" : ""} available`}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
