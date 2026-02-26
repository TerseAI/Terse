import { useMemo } from "react"
import { Link } from "react-router-dom"

import { Ban, Eye, Mail, Pencil, Plus, Stamp, Trash2 } from "lucide-react"

import { MultiSelect } from "../../components/MultiSelect"
import { SlackIcon } from "../../components/icons/IntegrationIcons"
import { Label } from "../../components/ui/label"
import { Switch } from "../../components/ui/switch"
import { useNotificationDestinations } from "../../hooks/api/useNotificationDestinations"
import { FrontendRoutes } from "../../shared/FrontendRoutes"
import { NotificationDestinationType, SlackNotificationDestination } from "../../shared/Notifications"
import { RunHistoryActionType } from "../../shared/RunHistoryTypes"
import { AgentNotificationSettings as AgentNotificationSettingsType, User } from "../../shared/types"

export type AgentNotificationSettingsProps = {
    settings: AgentNotificationSettingsType
    agentCreator: User | undefined
    onChange: (settings: AgentNotificationSettingsType) => void
}

function AgentNotificationSettings({ settings, agentCreator, onChange }: AgentNotificationSettingsProps) {
    const { notificationDestinations } = useNotificationDestinations()

    const activeSlackDestination = useMemo(
        () => (notificationDestinations ?? []).find(destination => destination.type === NotificationDestinationType.SLACK && destination.isActive !== false) as SlackNotificationDestination,
        [notificationDestinations]
    )

    const hasSlackOverride = Boolean(activeSlackDestination)

    const handleSelectEventTypes = (actionTypes: RunHistoryActionType[]) => {
        onChange({ ...settings, actionTypes, enabled: actionTypes.length > 0 })
    }

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-lg">
            <Label className="text-base font-medium">Notifications</Label>
            <div className="flex flex-wrap items-center gap-2">
                Send to:
                {hasSlackOverride ? (
                    <span className="flex items-center flex-row gap-1">
                        <div className="w-4 h-4">
                            <SlackIcon />
                        </div>{" "}
                        {activeSlackDestination?.slackChannelName}
                    </span>
                ) : (
                    <span className="flex items-center flex-row gap-1">
                        <Mail className="h-4 w-4 text-muted-foreground" /> {agentCreator ? agentCreator.email : "Notifications will be sent to creator's email"}
                    </span>
                )}
                <Link to={FrontendRoutes.NOTIFICATIONS} className="text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground">
                    (update)
                </Link>
            </div>
            <div className="flex flex-col gap-2">
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
                <p className="text-xs text-muted-foreground">Approval required and error notifications are always sent.</p>
            </div>
        </div>
    )
}

const EVENT_TYPE_OPTIONS: { value: RunHistoryActionType | "approval" | "error"; label: string; icon: React.ReactNode; readOnly?: boolean }[] = [
    { value: "create", label: "Create", icon: <Plus className="h-4 w-4" /> },
    { value: "update", label: "Update", icon: <Pencil className="h-4 w-4" /> },
    { value: "delete", label: "Delete", icon: <Trash2 className="h-4 w-4" /> },
    { value: "read", label: "Read", icon: <Eye className="h-4 w-4" /> }
]

export default AgentNotificationSettings
