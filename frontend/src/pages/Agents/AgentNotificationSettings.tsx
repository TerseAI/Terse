import { useMemo } from "react"
import { Link } from "react-router-dom"

import { Mail } from "lucide-react"

import { MultiSelect } from "../../components/MultiSelect"
import { SlackIcon } from "../../components/icons/IntegrationIcons"
import { Label } from "../../components/ui/label"
import { NOTIFICATION_ACTION_OPTIONS } from "../../constants/notificationActions"
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
    const notificationsSettingsLink = `${FrontendRoutes.NOTIFICATIONS}?addDestination=true`

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
                <Link to={notificationsSettingsLink} className="text-muted-foreground text-sm underline underline-offset-2 hover:text-foreground">
                    (update)
                </Link>
            </div>
            <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Notify me about</p>
                <MultiSelect
                    options={NOTIFICATION_ACTION_OPTIONS.map(option => ({
                        id: option.value,
                        label: option.label
                    }))}
                    selectedIds={settings.actionTypes}
                    onSelect={ids => handleSelectEventTypes(ids as RunHistoryActionType[])}
                    placeholder="Select event types..."
                    searchPlaceholder="Search types..."
                    emptyMessage="No types found."
                    displayText={count => (count > 0 ? `${count} selected` : "Select event types...")}
                    renderItem={option => {
                        const eventOption = NOTIFICATION_ACTION_OPTIONS.find(opt => opt.value === option.id)
                        return (
                            <span className="flex items-center gap-2">
                                {eventOption?.icon}
                                {option.label}
                            </span>
                        )
                    }}
                    renderBadge={option => {
                        const eventOption = NOTIFICATION_ACTION_OPTIONS.find(opt => opt.value === option.id)
                        return (
                            <span className="flex items-center gap-1">
                                {eventOption?.icon}
                                {option.label}
                            </span>
                        )
                    }}
                />
            </div>
        </div>
    )
}

export default AgentNotificationSettings
