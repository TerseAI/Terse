import { useEffect, useState } from "react"

import { AlertTriangleIcon, Plus } from "lucide-react"

import { SlackConnectionOptions } from "@/components/Integrations/helpers/SlackConnectionOptions"
import { SlackConfigurationSelector } from "@/components/SlackChannelSelector"
import DropdownSelect, { StatusOption } from "@/components/ui/DropdownSelect"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useSlackIntegrations } from "@/hooks/api/useSlackIntegrations"
import { useOAuthConnection } from "@/hooks/useOAuthConnection"
import { SlackKBConfig } from "@/shared/Configs"
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"

import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector"

export function SlackKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations()
    const [showConnectionOptions, setShowConnectionOptions] = useState(false)
    const [isBotUser, setIsBotUser] = useState(true)

    const slackConfig = (knowledgeBase.config as SlackKBConfig) || new SlackKBConfig("", undefined, undefined, false, [], [])
    const selectedIntegrationId = slackConfig.integrationId || null

    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.SLACK>(IntegrationType.SLACK, { isBotUser })

    // Auto-select integration when there's exactly one and none is currently selected
    useEffect(() => {
        if (!selectedIntegrationId && integrations.length === 1) {
            setConfig(new SlackKBConfig(integrations[0].id, undefined, undefined, false, [], []))
        }
    }, [selectedIntegrationId, integrations, setConfig])

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
        const userCount = slackConfig.userIds?.length ?? 0
        const displayText = slackConfig.allowDms
            ? userCount > 0
                ? `DMs: ${userCount} user${userCount !== 1 ? "s" : ""}`
                : "All DMs"
            : slackConfig.channelId
              ? slackConfig.channelName
                  ? `#${slackConfig.channelName}`
                  : "1 channel"
              : "Select channel or DMs"
        return <div className="text-xs text-center">{displayText}</div>
    }

    // Connection options screen
    if (showConnectionOptions) {
        return <SlackConnectionOptions isBotUser={isBotUser} setIsBotUser={setIsBotUser} onBack={() => setShowConnectionOptions(false)} onConnect={handleConnect} isConnecting={isOAuthConnecting} />
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
        setConfig(new SlackKBConfig(integrationId, undefined, undefined, false, [], []))
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: SlackIntegrationType) => ({
        label: `${integration.teamName || "Unknown Workspace"}${integration.isBotUser === false ? " - User" : " - Bot"}`,
        value: integration.id
    }))

    const selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId) ?? connectionSelections[0] ?? null

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <Label className="font-medium">Slack Workspace</Label>
                <DropdownSelect statusOptions={connectionSelections} selectedOption={selectedOption} setSelected={updateIntegrationId} placeholder="No connection selected" />
            </div>

            <Button onClick={() => setShowConnectionOptions(true)} disabled={isOAuthConnecting} variant="outline">
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? "Connecting..." : "Connect Another Slack"}
            </Button>

            {selectedIntegrationId &&
                (() => {
                    const selectedIntegration = integrations.find((i: SlackIntegrationType) => i.id === selectedIntegrationId)
                    return (
                        <div className="mt-3 pt-3 border-t border-border">
                            <SlackConfigurationSelector
                                integrationId={selectedIntegrationId}
                                selectedChannelId={slackConfig.channelId ?? ""}
                                listenToUserDms={slackConfig.allowDms}
                                selectedUserIds={slackConfig.userIds ?? []}
                                showListenToDMsOption={true}
                                showUserFilter={true}
                                isBotToken={selectedIntegration?.isBotUser ?? true}
                                mode="knowledgeBase"
                                onSelectChannel={(channelId, channelName) => {
                                    setConfig(new SlackKBConfig(slackConfig.integrationId, channelId || undefined, channelName, false, [], []))
                                }}
                                onListenToUserDmsChange={allowDms => {
                                    setConfig(
                                        new SlackKBConfig(
                                            slackConfig.integrationId,
                                            allowDms ? undefined : slackConfig.channelId,
                                            allowDms ? undefined : slackConfig.channelName,
                                            allowDms,
                                            allowDms ? (slackConfig.userIds ?? []) : [],
                                            []
                                        )
                                    )
                                }}
                                onSelectUsers={userIds => {
                                    setConfig(new SlackKBConfig(slackConfig.integrationId, undefined, undefined, true, userIds, []))
                                }}
                            />
                        </div>
                    )
                })()}
        </div>
    )
}
