import { Eye, Pencil, Plus, Trash2 } from "lucide-react"

import { MultiSelect } from "../../components/MultiSelect"
import { AddNotificationDestination } from "../../components/Notifications/AddNotificationDestination"
import { Button } from "../../components/ui/button"
import { Label } from "../../components/ui/label"
import { Switch } from "../../components/ui/switch"
import { useAuth } from "../../services/auth"
import { RunHistoryActionType } from "../../shared/RunHistoryTypes"
import { AgentNotificationSettings as AgentNotificationSettingsType } from "../../shared/types"

export type AgentNotificationSettingsProps = {
    settings: AgentNotificationSettingsType
    onChange: (settings: AgentNotificationSettingsType) => void
}

function AgentNotificationSettings({ settings, onChange }: AgentNotificationSettingsProps) {
    const { user } = useAuth()
    const defaultEmail = user?.email || "your account email"

    const handleToggleEnabled = (enabled: boolean) => {
        onChange({ ...settings, enabled })
    }

    const handleSelectEventTypes = (actionTypes: RunHistoryActionType[]) => {
        onChange({ ...settings, actionTypes })
    }

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <Label htmlFor="notifications-toggle" className="text-base font-medium">
                        CRUD Notifications
                    </Label>
                    <p className="text-sm text-muted-foreground">Optional and off by default. Enable these to get alerts for create, read, update, and delete actions.</p>
                </div>
                <Switch id="notifications-toggle" checked={settings.enabled} onCheckedChange={handleToggleEnabled} />
            </div>

            <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
                <div className="space-y-1">
                    <p className="text-sm font-medium">Always-on alerts</p>
                    <p className="text-sm text-muted-foreground">
                        Approval requests and run failures are always sent. By default, notifications go to <span className="text-foreground font-medium">{defaultEmail}</span>. Configure Slack to
                        route notifications there instead.
                    </p>
                </div>
                <AddNotificationDestination
                    trigger={
                        <Button variant="outline" size="sm" className="self-start">
                            <Plus className="size-4" />
                            Configure Slack destination
                        </Button>
                    }
                />
            </div>

            {settings.enabled && (
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
            )}
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
