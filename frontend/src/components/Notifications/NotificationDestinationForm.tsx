import { ReactNode, useEffect, useState } from "react"

import { Hash, UserRound } from "lucide-react"
import { toast } from "sonner"
import { mutate } from "swr"

import { useSlackChannels } from "../../hooks/api/useSlackChannels"
import { useSlackIntegrations } from "../../hooks/api/useSlackIntegrations"
import { useSlackUsers } from "../../hooks/api/useSlackUsers"
import { useOAuthSuccessListener } from "../../hooks/useOAuthSuccessListener"
import { cn } from "../../lib/utils"
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

    const slackDestination = existingDestination?.type === NotificationDestinationType.SLACK ? (existingDestination as SlackNotificationDestination) : undefined
    const isDmDestination = Boolean(slackDestination?.slackUserId)

    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(slackDestination?.integrationId)
    const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(isDmDestination ? undefined : slackDestination?.slackChannelId)
    const [selectedChannelName, setSelectedChannelName] = useState<string | undefined>(isDmDestination ? undefined : slackDestination?.slackChannelName)
    const [selectedUserId, setSelectedUserId] = useState<string | undefined>(slackDestination?.slackUserId)
    const [selectedUserName, setSelectedUserName] = useState<string | undefined>(slackDestination?.slackUserName)
    const [isConnecting, setIsConnecting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [showConnectionOptions, setShowConnectionOptions] = useState(false)
    const [isBotUser, setIsBotUser] = useState(true)

    const selectedSlackIntegration = integrations.find(integration => integration.id === selectedIntegrationId)
    const isEditMode = !!existingDestination

    useEffect(() => {
        if (!isEditMode && !selectedIntegrationId && integrations.length > 0) {
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
            setValidationError("Please select a Slack workspace.")
            return
        }

        const hasChannelTarget = Boolean(selectedChannelId)
        const hasUserTarget = Boolean(selectedUserId)

        if (hasChannelTarget === hasUserTarget) {
            setValidationError("Select exactly one Slack destination: one channel or one individual.")
            return
        }

        setIsSaving(true)
        try {
            if (isEditMode) {
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
            <div className="space-y-3 px-6 pb-6 pt-5">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-44 w-full rounded-xl" />
                <div className="flex justify-end">
                    <Skeleton className="h-10 w-24 rounded-md" />
                </div>
            </div>
        )
    }

    if (showConnectionOptions) {
        return <SlackConnectionOptions isBotUser={isBotUser} setIsBotUser={setIsBotUser} onBack={() => setShowConnectionOptions(false)} onConnect={connectSlack} isConnecting={isConnecting} />
    }

    if (integrations.length === 0) {
        return (
            <div className="px-6 pb-6 pt-5">
                <div className="rounded-xl border border-dashed bg-muted/20 p-6 text-center">
                    <p className="text-sm text-muted-foreground">No Slack integrations found. Connect a workspace to continue.</p>
                    <Button className="mt-4" onClick={() => setShowConnectionOptions(true)}>
                        Connect Slack Workspace
                    </Button>
                </div>
            </div>
        )
    }

    const options: StatusOption[] = integrations.map(integration => ({
        label: formatIntegrationLabel(integration),
        value: integration.id
    }))

    const selectedOption = options.find(option => option.value === selectedIntegrationId) ?? null

    return (
        <div className="space-y-5 px-6 pb-6 pt-5">
            <div className="space-y-3 rounded-xl p-4 sm:p-5">
                <div className="space-y-1">
                    <Label className="text-sm font-medium">Slack Workspace</Label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                        <DropdownSelect
                            statusOptions={options}
                            selectedOption={selectedOption}
                            setSelected={id => {
                                setSelectedIntegrationId(id)
                                if (id !== selectedIntegrationId) {
                                    setSelectedChannelId(undefined)
                                    setSelectedChannelName(undefined)
                                    setSelectedUserId(undefined)
                                    setSelectedUserName(undefined)
                                }
                            }}
                            modal={false}
                            triggerClassName="h-11 w-full justify-between rounded-lg border-border/80 bg-background px-3 text-left"
                            contentClassName="w-[var(--radix-dropdown-menu-trigger-width)]"
                        />
                    </div>
                    <Button variant="outline" className="h-11 shrink-0" onClick={() => setShowConnectionOptions(true)}>
                        Connect Another Workspace
                    </Button>
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
            </div>

            {validationError && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{validationError}</div>}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end">
                {onCancel && (
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                )}
                <Button onClick={saveDestination} disabled={isSaving} className="min-w-24">
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
        return <Skeleton className="h-44 w-full rounded-xl" />
    }

    const noneOptionValue = "__none__"
    const showNoChannelsNotice = Boolean(isBotUser && channels.length === 0)
    const effectiveChannelId = selectedUserId ? undefined : selectedChannelId
    const effectiveChannelName = selectedUserId ? undefined : selectedChannelName

    return (
        <div className="space-y-3 rounded-xl">
            <div className="space-y-1">
                <p className="text-sm font-medium">Destination</p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <DestinationTargetCard title="Slack Channel" description="Post in a channel the bot can access." icon={<Hash className="size-4" />} isActive={Boolean(selectedChannelId)}>
                    <Select
                        value={effectiveChannelId ?? noneOptionValue}
                        onValueChange={value => {
                            if (value === noneOptionValue) {
                                onSelectChannel(undefined, undefined)
                                return
                            }
                            const selectedChannel = channels.find(ch => ch.id === value)
                            onSelectChannel(value, selectedChannel?.name ?? undefined)
                        }}
                    >
                        <SelectTrigger id="notification-destination-channel" className="h-11 w-full rounded-lg border-border/80 bg-background">
                            <SelectValue placeholder="Select a channel" />
                        </SelectTrigger>
                        <SelectContent align="start">
                            <SelectItem value={noneOptionValue}>No channel selected</SelectItem>
                            {effectiveChannelId && !channels.some(ch => ch.id === effectiveChannelId) && (
                                <SelectItem value={effectiveChannelId}>{effectiveChannelName ? formatMPIMChannelName(effectiveChannelName) : effectiveChannelId}</SelectItem>
                            )}
                            <ChannelOptions channels={channels} />
                        </SelectContent>
                    </Select>

                    {showNoChannelsNotice && (
                        <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300">No channels available yet</p>
                            <p className="text-xs text-amber-700/90 dark:text-amber-200/80">
                                Invite the Terse bot with <code className="rounded bg-amber-500/20 px-1 py-0.5">/invite @Terse</code>, or use Individual (DM) instead.
                            </p>
                        </div>
                    )}
                </DestinationTargetCard>

                <DestinationTargetCard title="Individual (DM)" description="Send direct messages to one teammate." icon={<UserRound className="size-4" />} isActive={Boolean(selectedUserId)}>
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
                        <SelectTrigger id="notification-destination-user" className="h-11 w-full rounded-lg border-border/80 bg-background">
                            <SelectValue placeholder="Select one user" />
                        </SelectTrigger>
                        <SelectContent align="start">
                            <SelectItem value={noneOptionValue}>No individual selected</SelectItem>
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
                </DestinationTargetCard>
            </div>
        </div>
    )
}

function DestinationTargetCard({ title, description, icon, isActive, children }: { title: string; description: string; icon: ReactNode; isActive: boolean; children: ReactNode }) {
    return (
        <div className={cn("rounded-lg border p-4 transition-colors", isActive ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border/80 bg-background/60")}>
            <div className="mb-3 flex items-start gap-3">
                <div
                    className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border",
                        isActive ? "border-primary/40 bg-primary/10 text-primary" : "border-border/80 bg-muted/60 text-muted-foreground"
                    )}
                >
                    {icon}
                </div>
                <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-none">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
            {children}
        </div>
    )
}

function ChannelOptions({ channels }: { channels: SlackChannel[] }) {
    const publicChannels = channels.filter(ch => !ch.isPrivate && !ch.isArchived)
    const privateChannels = channels.filter(ch => ch.isPrivate && !ch.isArchived)

    return (
        <>
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
                            {channel.isMPIM ? formatMPIMChannelName(channel.name) : `#${channel.name}`}
                        </SelectItem>
                    ))}
                </SelectGroup>
            )}
        </>
    )
}

function formatIntegrationLabel(integration: SlackIntegration) {
    const isBotUser = integration.isBotUser === true
    return `${integration.teamName || "Unknown Workspace"}${isBotUser ? " - Bot" : " - User"}`
}
