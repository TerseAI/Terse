import { useMemo, useState } from "react"

import { Eye, Pencil, Plus, Trash2 } from "lucide-react"

import { MultiSelect } from "../../components/MultiSelect"
import { AddNotificationDestination } from "../../components/Notifications/AddNotificationDestination"
import { EditNotificationDestinationDialog } from "../../components/Notifications/EditNotificationDestination"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Label } from "../../components/ui/label"
import { Switch } from "../../components/ui/switch"
import { useNotificationDestinations } from "../../hooks/api/useNotificationDestinations"
import { NotificationDestinationType } from "../../shared/Notifications"
import { RunHistoryActionType } from "../../shared/RunHistoryTypes"
import { AgentNotificationSettings as AgentNotificationSettingsType } from "../../shared/types"

export type AgentNotificationSettingsProps = {
    settings: AgentNotificationSettingsType
    onChange: (settings: AgentNotificationSettingsType) => void
}

function AgentNotificationSettings({ settings, onChange }: AgentNotificationSettingsProps) {
    const { notificationDestinations } = useNotificationDestinations()
    const [isEditSlackDestinationOpen, setIsEditSlackDestinationOpen] = useState(false)

    const activeSlackDestination = useMemo(
        () => (notificationDestinations ?? []).find(destination => destination.type === NotificationDestinationType.SLACK && destination.isActive !== false),
        [notificationDestinations]
    )

    const hasSlackOverride = Boolean(activeSlackDestination)
    const crudAlertCount = settings.enabled ? settings.actionTypes.length : 0

    const handleToggleEnabled = (enabled: boolean) => {
        onChange({ ...settings, enabled })
    }

    const handleSelectEventTypes = (actionTypes: RunHistoryActionType[]) => {
        onChange({ ...settings, actionTypes })
    }

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-lg">
            <Label className="text-base font-medium">Notification Destinations</Label>
            <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Always-on: approvals + failures</Badge>
                <Badge variant="outline">Optional Alerts: {crudAlertCount} selected</Badge>
                <Badge variant={hasSlackOverride ? "default" : "secondary"}>Destination: {hasSlackOverride ? "Slack" : "Email"}</Badge>
            </div>

            <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
                <div className="space-y-1">
                    <Label className="text-sm font-medium">Destination</Label>
                    <p className="text-sm text-muted-foreground">{hasSlackOverride ? "Slack override is active. Alerts route to Slack." : "Default is email to the user who created this agent."}</p>
                    <p className="text-xs text-muted-foreground">
                        {hasSlackOverride ? "Edit the Slack destination or remove it to fall back to email." : "Configure Slack to route alerts there instead."}
                    </p>
                </div>
                {activeSlackDestination ? (
                    <>
                        <Button variant="outline" size="sm" className="self-start" onClick={() => setIsEditSlackDestinationOpen(true)}>
                            Edit Slack destination
                        </Button>
                        <EditNotificationDestinationDialog destination={activeSlackDestination} open={isEditSlackDestinationOpen} onOpenChange={setIsEditSlackDestinationOpen} />
                    </>
                ) : (
                    <AddNotificationDestination
                        trigger={
                            <Button variant="outline" size="sm" className="self-start">
                                <Plus className="size-4" />
                                Configure Slack destination
                            </Button>
                        }
                    />
                )}
            </div>

            <div className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <Label htmlFor="notifications-toggle" className="text-sm font-medium">
                            Extra activity alerts
                        </Label>
                        <p className="text-sm text-muted-foreground">Optional Create/Read/Update/Delete alerts. Off by default.</p>
                    </div>
                    <Switch id="notifications-toggle" checked={settings.enabled} onCheckedChange={handleToggleEnabled} />
                </div>

                {settings.enabled ? (
                    <div className="flex flex-col gap-2">
                        <Label className="text-sm font-medium">Notify for these action types</Label>
                        <MultiSelect
                            options={EVENT_TYPE_OPTIONS.map(option => ({
                                id: option.value,
                                label: option.label
                            }))}
                            selectedIds={settings.actionTypes}
                            onSelect={ids => handleSelectEventTypes(ids as RunHistoryActionType[])}
                            placeholder="Select event types..."
                            searchPlaceholder="Search event types..."
                            emptyMessage="No event types found."
                            displayText={count => (count > 0 ? `${count} event type${count !== 1 ? "s" : ""} selected` : "Select event types...")}
                            renderItem={option => {
                                const eventOption = EVENT_TYPE_OPTIONS.find(opt => opt.value === option.id)
                                return (
                                    <span className="flex items-center gap-2">
                                        {eventOption?.icon}
                                        {option.label}
                                    </span>
                                )
                            }}
                            renderBadge={option => {
                                const eventOption = EVENT_TYPE_OPTIONS.find(opt => opt.value === option.id)
                                return (
                                    <span className="flex items-center gap-1">
                                        {eventOption?.icon}
                                        {option.label}
                                    </span>
                                )
                            }}
                        />
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">No extra activity alerts selected.</p>
                )}
            </div>
        </div>
    )
}

const EVENT_TYPE_OPTIONS: { value: RunHistoryActionType; label: string; icon: React.ReactNode }[] = [
    { value: "create", label: "Create", icon: <Plus className="h-4 w-4" /> },
    { value: "update", label: "Update", icon: <Pencil className="h-4 w-4" /> },
    { value: "delete", label: "Delete", icon: <Trash2 className="h-4 w-4" /> },
    { value: "read", label: "Read", icon: <Eye className="h-4 w-4" /> }
]

export default AgentNotificationSettings
