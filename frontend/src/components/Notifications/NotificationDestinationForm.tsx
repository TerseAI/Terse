import { useEffect, useState } from "react"

import { toast } from "sonner"
import { mutate } from "swr"

import { useSlackChannels } from "../../hooks/api/useSlackChannels"
import { useSlackIntegrations } from "../../hooks/api/useSlackIntegrations"
import { useSlackUsers } from "../../hooks/api/useSlackUsers"
import { useOAuthSuccessListener } from "../../hooks/useOAuthSuccessListener"
import { BackendProvider } from "../../services/backend"
import { IntegrationType, SlackIntegration } from "../../shared/Integrations"
import { notificationDestinationsKey } from "../../shared/InvalidationKeys"
import { CreateNotificationDestinationRequest, NotificationDestination, NotificationDestinationType, SlackNotificationDestination } from "../../shared/Notifications"
import { SlackChannel } from "../../shared/types"
import { SlackConnectionOptions } from "../Integrations/helpers/SlackConnectionOptions"
import { formatMPIMChannelName } from "../SlackChannelSelector"
import DropdownSelect, { StatusOption } from "../ui/DropdownSelect"
import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select"
import { Skeleton } from "../ui/skeleton"

export interface NotificationDestinationFormProps {
    existingDestination?: NotificationDestination
    onSuccess?: () => void
    onCancel?: () => void
}

export function NotificationDestinationForm({ existingDestination, onSuccess, onCancel }: NotificationDestinationFormProps) {
    const { integrations, isLoading } = useSlackIntegrations()

    // For edit mode with Slack, use the existing integration ID
    const slackDestination = existingDestination?.type === NotificationDestinationType.SLACK ? (existingDestination as SlackNotificationDestination) : undefined

    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(slackDestination?.integrationId)
    const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(slackDestination?.slackChannelId)
    const [selectedChannelName, setSelectedChannelName] = useState<string | undefined>(slackDestination?.slackChannelName)
    const [selectedUserId, setSelectedUserId] = useState<string | undefined>(slackDestination?.slackUserId)
    const [selectedUserName, setSelectedUserName] = useState<string | undefined>(slackDestination?.slackUserName)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [showConnectionOptions, setShowConnectionOptions] = useState(false)
    const [isBotUser, setIsBotUser] = useState(true)

    const selectedSlackIntegration = integrations.find(integration => integration.id === selectedIntegrationId)

    const isEditMode = !!existingDestination

    // Initialize integration selection when integrations load (for new destinations)
    useEffect(() => {
        if (!isEditMode && !selectedIntegrationId && integrations.length === 1) {
            setSelectedIntegrationId(integrations[0].id)
        }
    }, [integrations, isEditMode, selectedIntegrationId])

    const connectSlack = async () => {
        setIsConnecting(true)
        try {
            const installationDetails = await BackendProvider.getIntegrationInstallationDetails(IntegrationType.SLACK, { isBotUser })

            if (installationDetails?.oauthUrl) {
                window.open(installationDetails.oauthUrl, "oauth-popup", "width=600,height=700")
                setShowConnectionOptions(false)
            } else {
                console.error("OAuth URL not available for this integration type")
            }
        } catch (error) {
            console.error("Error initiating OAuth:", error)
        } finally {
            setIsConnecting(false)
        }
    }

    async function saveDestination() {
        setValidationError(null)

        if (!selectedIntegrationId) {
            setValidationError("Please select a Slack workspace")
            return
        }

        const hasChannelTarget = Boolean(selectedChannelId)
        const hasUserTarget = Boolean(selectedUserId)

        if (hasChannelTarget === hasUserTarget) {
            setValidationError("Select exactly one Slack destination: either one channel or one individual.")
            return
        }

        setIsSaving(true)
        try {
            if (isEditMode) {
                // Update existing destination
                    await BackendProvider.updateNotificationDestination({
                        id: existingDestination.id,
                        type: NotificationDestinationType.SLACK,
                        integrationId: selectedIntegrationId,
                        slackChannelId: selectedChannelId,
                        slackChannelName: selectedChannelName,
                        slackUserId: selectedUserId,
                        slackUserName: selectedUserName
                    } as SlackNotificationDestination)
                toast.success("Notification destination updated successfully")
            } else {
                // Create new destination
                const payload: CreateNotificationDestinationRequest = {
                    type: NotificationDestinationType.SLACK,
                    integrationId: selectedIntegrationId,
                    slackChannelId: selectedChannelId,
                    slackChannelName: selectedChannelName,
                    slackUserId: selectedUserId,
                    slackUserName: selectedUserName
                }
                await BackendProvider.createNotificationDestination(payload)
                toast.success("Notification destination added successfully")
            }
            mutate(notificationDestinationsKey())
            onSuccess?.()
        } catch (error) {
            console.error("Failed to save notification destination:", error)
            toast.error(`Failed to ${isEditMode ? "update" : "add"} notification destination. Please try again.`)
        } finally {
            setIsSaving(false)
        }
    }

    useOAuthSuccessListener(mutate, () => {
        setIsConnecting(false)
    })

    if (isLoading || isConnecting) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    if (showConnectionOptions) {
        return <SlackConnectionOptions isBotUser={isBotUser} setIsBotUser={setIsBotUser} onBack={() => setShowConnectionOptions(false)} onConnect={connectSlack} isConnecting={isConnecting} />
    }

    if (integrations.length === 0) {
        return (
            <div>
                No Slack integrations found.{" "}
                <Button variant="link" onClick={() => setShowConnectionOptions(true)}>
                    Connect a Slack integration
                </Button>
            </div>
        )
    }

    const options: StatusOption[] = integrations.map(integration => ({
        label: formatIntegrationLabel(integration),
        value: integration.id
    }))

    const selectedOption = options.find(option => option.value === selectedIntegrationId) || options[0]

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-2 items-center">
                <p>Send notifications to:</p>
                <DropdownSelect
                    statusOptions={options}
                    selectedOption={selectedOption}
                    setSelected={id => {
                        setSelectedIntegrationId(id)
                        // Reset destination selection when workspace changes
                        if (id !== selectedIntegrationId) {
                            setSelectedChannelId(undefined)
                            setSelectedChannelName(undefined)
                            setSelectedUserId(undefined)
                            setSelectedUserName(undefined)
                        }
                    }}
                    additionalAction={{
                        label: "Connect Another Slack Workspace",
                        onClick: () => setShowConnectionOptions(true)
                    }}
                    modal={false}
                />
            </div>
            {selectedIntegrationId && (
                <SelectSlackDestinationForm
                    integrationId={selectedIntegrationId}
                    isBotUser={selectedSlackIntegration?.isBotUser}
                    selectedChannelId={selectedChannelId}
                    selectedChannelName={selectedChannelName}
                    selectedUserId={selectedUserId}
                    selectedUserName={selectedUserName}
                    onSelectChannel={(channelId, channelName) => {
                        setSelectedChannelId(channelId)
                        setSelectedChannelName(channelName)
                        if (channelId) {
                            setSelectedUserId(undefined)
                            setSelectedUserName(undefined)
                        }
                    }}
                    onSelectUser={(userId, userName) => {
                        setSelectedUserId(userId)
                        setSelectedUserName(userName)
                        if (userId) {
                            setSelectedChannelId(undefined)
                            setSelectedChannelName(undefined)
                        }
                    }}
                />
            )}

            {validationError && <p className="text-sm text-destructive">{validationError}</p>}

            <div className="flex flex-row gap-2 justify-end">
                {onCancel && (
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button onClick={saveDestination} disabled={isSaving}>
                    {isSaving ? "Saving..." : isEditMode ? "Update" : "Save"}
                </Button>
            </div>
        </div>
    )
}

interface SelectSlackDestinationFormProps {
    integrationId: string
    isBotUser?: boolean
    selectedChannelId?: string
    selectedChannelName?: string
    selectedUserId?: string
    selectedUserName?: string
    onSelectChannel: (channelId?: string, channelName?: string) => void
    onSelectUser: (userId?: string, userName?: string) => void
}

function SelectSlackDestinationForm({
    integrationId,
    isBotUser,
    selectedChannelId,
    selectedChannelName,
    selectedUserId,
    selectedUserName,
    onSelectChannel,
    onSelectUser
}: SelectSlackDestinationFormProps) {
    const { channels, isLoading } = useSlackChannels(integrationId)
    const { users, isLoading: usersLoading } = useSlackUsers(integrationId)

    if (isLoading || usersLoading) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
            </div>
        )
    }

    const noneOptionValue = "__none__"
    const showNoChannelsNotice = Boolean(isBotUser && channels.length === 0)

    return (
        <div className="flex flex-col gap-3 rounded-md border p-3">
            <p className="text-sm text-muted-foreground">Choose one destination. Selecting a channel will clear any user selection, and selecting a user will clear any channel selection.</p>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="notification-destination-channel">Slack Channel</Label>
                    <Select
                        value={selectedChannelId ?? noneOptionValue}
                        onValueChange={value => {
                            if (value === noneOptionValue) {
                                onSelectChannel(undefined, undefined)
                                return
                            }
                            const selectedChannel = channels.find(ch => ch.id === value)
                            onSelectChannel(value, selectedChannel?.name ?? undefined)
                        }}
                    >
                        <SelectTrigger id="notification-destination-channel">
                            <SelectValue placeholder="Select a channel" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={noneOptionValue}>None</SelectItem>
                            {selectedChannelId && !channels.some(ch => ch.id === selectedChannelId) && (
                                <SelectItem value={selectedChannelId}>{selectedChannelName ? formatMPIMChannelName(selectedChannelName) : selectedChannelId}</SelectItem>
                            )}
                            <ChannelOptions channels={channels} />
                        </SelectContent>
                    </Select>
                    {showNoChannelsNotice && (
                        <div className="rounded-md border border-border bg-muted/50 p-2">
                            <p className="text-xs font-medium text-foreground">No channels available yet</p>
                            <p className="text-xs text-muted-foreground">
                                Invite the Terse bot with <code className="rounded bg-muted px-1 py-0.5 text-foreground">/invite @Terse</code>, or use Individual (DM) instead.
                            </p>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="notification-destination-user">Individual (DM)</Label>
                    <Select
                        value={selectedUserId ?? noneOptionValue}
                        onValueChange={value => {
                            if (value === noneOptionValue) {
                                onSelectUser(undefined, undefined)
                                return
                            }
                            const selectedUser = users.find(user => user.id === value)
                            onSelectUser(value, selectedUser?.name ?? undefined)
                        }}
                    >
                        <SelectTrigger id="notification-destination-user">
                            <SelectValue placeholder="Select one user" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={noneOptionValue}>None</SelectItem>
                            {selectedUserId && !users.some(user => user.id === selectedUserId) && <SelectItem value={selectedUserId}>{selectedUserName ?? selectedUserId}</SelectItem>}
                            <SelectGroup>
                                <SelectLabel>Users</SelectLabel>
                                {users.map(user => (
                                    <SelectItem key={user.id} value={user.id}>
                                        {user.name}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )
}

function ChannelOptions({ channels }: { channels: SlackChannel[] }) {
    const publicChannels = channels.filter(ch => !ch.isPrivate && !ch.isArchived)
    const privateChannels = channels.filter(ch => ch.isPrivate && !ch.isArchived)

    return (
        <>
            <SelectGroup>
                <SelectLabel>Public Channels</SelectLabel>
                {publicChannels.map(channel => (
                    <SelectItem key={channel.id} value={channel.id}>
                        #{channel.name}
                    </SelectItem>
                ))}
            </SelectGroup>
            <SelectGroup>
                <SelectLabel>Private Channels</SelectLabel>
                {privateChannels.map(channel => (
                    <SelectItem key={channel.id} value={channel.id}>
                        🔒 {channel.isMPIM ? formatMPIMChannelName(channel.name) : `#${channel.name}`}
                    </SelectItem>
                ))}
            </SelectGroup>
        </>
    )
}

function formatIntegrationLabel(integration: SlackIntegration) {
    const isBotUser = integration.isBotUser === true
    return `${integration.teamName || "Unknown Workspace"}${isBotUser ? " - Bot" : " - User"}`
}
