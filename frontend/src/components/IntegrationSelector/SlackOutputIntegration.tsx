import { useState } from "react"

import { AlertTriangleIcon, Hash, MessageCircle, Plus } from "lucide-react"

import { useSlackIntegrations } from "@/hooks/api/useSlackIntegrations"
import { useSlackUsers } from "@/hooks/api/useSlackUsers"
import { useIntegrationId } from "@/hooks/useIntegrationId"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"

import { IconForConfigType } from "../../pages/Agents/components/Integration"
import { ConfigType, SlackOutputConfig } from "../../shared/Configs"
import { SlackConnectionOptions } from "../Integrations/helpers/SlackConnectionOptions"
import { SlackConfigurationSelector } from "../SlackChannelSelector"
import DropdownSelect from "../ui/DropdownSelect"
import { Button } from "../ui/button"

import { InputConfigSelectorProps } from "./types"

export function SlackOutputIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations()
    const currentConfig = input.config as SlackOutputConfig | undefined
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.SLACK_OUTPUT)

    // Connection options
    const [showConnectionOptions, setShowConnectionOptions] = useState(false)
    const [isBotUser, setIsBotUser] = useState(true)

    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.SLACK>(IntegrationType.SLACK, { isBotUser })
    const { users } = useSlackUsers(selectedIntegrationId ?? null)

    const handleConnect = async () => {
        await connectOAuth()
        setShowConnectionOptions(false)
    }

    function onSelectIntegration(value: string) {
        const integration = integrations.find((integration: SlackIntegrationType) => integration.id === value)
        if (integration) {
            setSelectedIntegrationId(integration.id)
            setConfig(new SlackOutputConfig(integration.id, undefined, undefined, undefined, undefined))
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
        const sameIntegration = currentConfig?.integrationId === defaultIntegration.value
        setConfig(
            new SlackOutputConfig(
                defaultIntegration.value,
                sameIntegration ? currentConfig?.channelId : undefined,
                sameIntegration ? currentConfig?.channelName : undefined,
                sameIntegration ? currentConfig?.userIds : undefined,
                undefined
            )
        )
        selectedOption = defaultIntegration
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0]
    }

    // Card variant: compact view
    if (variant === "card") {
        const hasConfig = !!currentConfig && !!currentConfig.integrationId
        const hasDestination = !!(currentConfig?.channelId || (currentConfig?.userIds?.length ?? 0) > 0)
        const isComplete = hasConfig && hasDestination
        if (!isComplete) {
            if (!hasConfig) {
                return (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AlertTriangleIcon className="size-3 text-yellow-500" />
                        Configure
                    </div>
                )
            }
            if (!hasDestination) {
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
        const isDmOnly = (currentConfig?.userIds?.length ?? 0) > 0 && !currentConfig?.channelId
        const dmUserNames = isDmOnly && currentConfig?.userIds?.length && users?.length ? currentConfig.userIds.map(id => users.find(u => u.id === id)?.name ?? id).filter(Boolean) : []
        const summary = isDmOnly
            ? dmUserNames.length > 0
                ? `DM to ${dmUserNames.join(", ")}`
                : `DM to ${currentConfig?.userIds?.length ?? 0} user${(currentConfig?.userIds?.length ?? 0) === 1 ? "" : "s"}`
            : currentConfig?.channelName || selectedOption?.label || "No connection selected"
        return (
            <div className="text-sm flex items-center gap-1">
                {isDmOnly ? <MessageCircle className="w-3 h-3 text-muted-foreground shrink-0" /> : <Hash className="w-3 h-3 text-muted-foreground shrink-0" />}
                <span className="truncate">{summary}</span>
            </div>
        )
    }

    const sendToDms = (currentConfig?.userIds?.length ?? 0) > 0 && !currentConfig?.channelId
    const selectedIntegration = integrations.find((i: SlackIntegrationType) => i.id === selectedIntegrationId)

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

            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border min-w-0 overflow-hidden">
                    {!currentConfig?.channelId && !sendToDms && <p className="text-sm text-muted-foreground mb-3">Select where Terse should send messages</p>}
                    <SlackConfigurationSelector
                        integrationId={selectedIntegrationId}
                        selectedChannelId={currentConfig?.channelId ?? ""}
                        listenToUserDms={sendToDms}
                        selectedUserIds={currentConfig?.userIds ?? []}
                        showListenToDMsOption={true}
                        showUserFilter={true}
                        isBotToken={selectedIntegration?.isBotUser ?? true}
                        mode="output"
                        onSelectChannel={(channelId, channelName) => {
                            const hasChannel = !!channelId?.trim()
                            setConfig(new SlackOutputConfig(selectedIntegrationId, hasChannel ? channelId : undefined, hasChannel ? channelName : undefined, undefined, undefined))
                        }}
                        onListenToUserDmsChange={listenToUserDms => {
                            if (listenToUserDms) {
                                setConfig(new SlackOutputConfig(selectedIntegrationId, undefined, undefined, currentConfig?.userIds ?? [], undefined))
                            } else {
                                setConfig(new SlackOutputConfig(selectedIntegrationId, currentConfig?.channelId, currentConfig?.channelName, undefined, undefined))
                            }
                        }}
                        onSelectUsers={userIds => {
                            setConfig(new SlackOutputConfig(selectedIntegrationId, undefined, undefined, userIds, undefined))
                        }}
                    />
                </div>
            )}

            <Button onClick={onClickConnect} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Slack"}
            </Button>
        </div>
    )
}
