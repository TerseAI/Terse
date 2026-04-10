import { useState } from "react"

import { AlertTriangleIcon, Plus } from "lucide-react"
import { isConfigComplete } from "terse-types"
import { SlackConfig, SlackEventType } from "terse-types"
import { ConfigType } from "terse-types"
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "terse-types/Integrations"

import { useSlackIntegrations } from "@/hooks/api/useSlackIntegrations"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"

import { SlackConnectionOptions } from "../Integrations/helpers/SlackConnectionOptions"
import { SlackConfigurationSelector } from "../SlackChannelSelector"
import DropdownSelect from "../ui/DropdownSelect"
import { StatusOption } from "../ui/DropdownSelect"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { Label } from "../ui/label"

import { InputConfigSelectorProps } from "./types"

const SLACK_EVENT_TYPES: { value: SlackEventType; label: string; description: string }[] = [
    { value: SlackEventType.MESSAGE, label: "Message", description: "A regular Slack message is posted" },
    { value: SlackEventType.APP_MENTION, label: "App Mention", description: "The Slack app is directly mentioned" },
    { value: SlackEventType.REACTION_ADDED, label: "Reaction Added", description: "A user adds a reaction to a message" }
]

export function SlackIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations()

    // Connection options
    const [showConnectionOptions, setShowConnectionOptions] = useState(false)
    const [isBotUser, setIsBotUser] = useState(true)

    const currentConfig = input.config as SlackConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.SLACK)

    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.SLACK>(IntegrationType.SLACK, { isBotUser })

    const handleConnect = async () => {
        await connectOAuth()
        // Return to previous page after opening OAuth popup
        setShowConnectionOptions(false)
    }

    function onSelect(value: string) {
        const integration = integrations.find((integration: SlackIntegrationType) => integration.id === value)
        if (integration) {
            setSelectedIntegrationId(integration.id)
            setConfig(new SlackConfig(integration.id, undefined, undefined, false, undefined, currentConfig?.eventTypes || []))
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
                    <AlertTriangleIcon className="size-3 text-warning" />
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

    const connectionSelections: StatusOption[] = integrations.map((integration: SlackIntegrationType) => ({
        label: `${integration.teamName || "Unknown Workspace"}${integration.isBotUser === false ? " - User" : " - Bot"}`,
        value: integration.id
    }))

    let selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId)
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0]
        setSelectedIntegrationId(defaultIntegration.value)
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    // Card variant: compact view
    if (variant === "card") {
        const isComplete = isConfigComplete(currentConfig)
        if (!isComplete) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 max-w-full">
                    <AlertTriangleIcon className="size-3 text-warning" />
                    <span className="truncate">Connect Slack</span>
                </div>
            )
        }

        return <div className="text-sm">{selectedOption ? selectedOption.label : "No connection selected"}</div>
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <label className="font-medium">Slack Workspace</label>
                <DropdownSelect statusOptions={connectionSelections} selectedOption={selectedOption} setSelected={onSelect} placeholder="No connection selected" />
            </div>

            <Button onClick={onClickConnect} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Slack"}
            </Button>

            {/* Slack-specific channel selector */}
            {selectedIntegrationId &&
                (() => {
                    const selectedIntegration = integrations.find((integration: SlackIntegrationType) => integration.id === selectedIntegrationId)
                    const isBotUser = selectedIntegration?.isBotUser ?? true // Default to true (bot) if not specified

                    return (
                        <div className="mt-3 pt-3 border-t border-border">
                            <SlackConfigurationSelector
                                integrationId={selectedIntegrationId}
                                selectedChannelId={currentConfig?.channelId ?? ""}
                                selectedUserIds={currentConfig?.userIds ?? []}
                                listenToUserDms={currentConfig?.listenToUserDms}
                                showListenToDMsOption={true}
                                showUserFilter={true}
                                isBotToken={isBotUser}
                                onSelectChannel={(channelId, agentName) => {
                                    const hasChannel = channelId && channelId.trim() !== ""
                                    const updatedConfig = new SlackConfig(
                                        selectedIntegrationId,
                                        hasChannel ? channelId : undefined,
                                        hasChannel ? agentName : undefined,
                                        hasChannel ? false : currentConfig?.listenToUserDms,
                                        currentConfig?.userIds,
                                        currentConfig?.eventTypes
                                    )
                                    setConfig(updatedConfig)
                                }}
                                onListenToUserDmsChange={listenToUserDms => {
                                    const updatedConfig = new SlackConfig(
                                        selectedIntegrationId,
                                        listenToUserDms ? undefined : currentConfig?.channelId,
                                        listenToUserDms ? undefined : currentConfig?.channelName,
                                        listenToUserDms,
                                        currentConfig?.userIds,
                                        currentConfig?.eventTypes
                                    )
                                    setConfig(updatedConfig)
                                }}
                                onSelectUsers={userIds => {
                                    const updatedConfig = new SlackConfig(
                                        selectedIntegrationId,
                                        currentConfig?.channelId,
                                        currentConfig?.channelName,
                                        currentConfig?.listenToUserDms,
                                        userIds,
                                        currentConfig?.eventTypes
                                    )
                                    setConfig(updatedConfig)
                                }}
                            />
                            <div className="mt-4 space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-sm font-medium">Event Types</Label>
                                    <p className="text-xs text-muted-foreground">Select the Slack events that should trigger this agent.</p>
                                </div>
                                <div className="space-y-2">
                                    {SLACK_EVENT_TYPES.map(eventType => (
                                        <label key={eventType.value} className="flex items-start gap-3 p-3 rounded-md border border-border hover:bg-accent/50 cursor-pointer">
                                            <Checkbox
                                                checked={currentConfig?.eventTypes?.includes(eventType.value) || false}
                                                onCheckedChange={checked => {
                                                    const nextEventTypes = checked
                                                        ? [...(currentConfig?.eventTypes || []), eventType.value]
                                                        : (currentConfig?.eventTypes || []).filter(type => type !== eventType.value)
                                                    setConfig(
                                                        new SlackConfig(
                                                            selectedIntegrationId,
                                                            currentConfig?.channelId,
                                                            currentConfig?.channelName,
                                                            currentConfig?.listenToUserDms,
                                                            currentConfig?.userIds,
                                                            nextEventTypes
                                                        )
                                                    )
                                                }}
                                                className="mt-0.5"
                                            />
                                            <div className="space-y-0.5">
                                                <div className="text-sm font-medium">{eventType.label}</div>
                                                <div className="text-xs text-muted-foreground">{eventType.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                })()}
        </div>
    )
}
