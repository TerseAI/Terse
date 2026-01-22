import { Switch } from "../../components/ui/switch";
import { RunHistoryActionType } from "../../shared/RunHistoryTypes";
import { AgentNotificationSettings as AgentNotificationSettingsType } from "../../shared/types";
import { Plus, Pencil, Trash2, Eye, AlertTriangle } from "lucide-react";
import { Label } from "../../components/ui/label";
import { Button } from "../../components/ui/button";
import { useNotificationDestinations } from "../../hooks/api/useNotificationDestinations";
import { AddNotificationDestination } from "../../components/Notifications/AddNotificationDestination";
import { MultiSelect } from "../../components/MultiSelect";

export type AgentNotificationSettingsProps = {
    settings: AgentNotificationSettingsType;
    onChange: (settings: AgentNotificationSettingsType) => void;
};

function AgentNotificationSettings({ settings, onChange }: AgentNotificationSettingsProps) {
    const { notificationDestinations, isValidating } = useNotificationDestinations();
    const hasNoDestinations = !isValidating && (!notificationDestinations || notificationDestinations.length === 0);

    const handleToggleEnabled = (enabled: boolean) => {
        onChange({ ...settings, enabled });
    };

    const handleSelectEventTypes = (actionTypes: RunHistoryActionType[]) => {
        onChange({ ...settings, actionTypes });
    };

    const showNoDestinationsWarning = settings.enabled && hasNoDestinations;

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="notifications-toggle" className="text-base font-medium">Notifications</Label>
                        {showNoDestinationsWarning && (
                            <AlertTriangle className="size-4 text-yellow-500" />
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">Get notified when this channel takes actions</p>
                </div>
                <Switch 
                    id="notifications-toggle"
                    checked={settings.enabled} 
                    onCheckedChange={handleToggleEnabled} 
                />
            </div>
            {showNoDestinationsWarning && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-yellow-500 shrink-0" />
                        <p className="text-sm text-yellow-600 dark:text-yellow-500">
                            No notification destinations configured.
                        </p>
                    </div>
                    <AddNotificationDestination 
                        trigger={
                            <Button variant="outline" size="sm">
                                <Plus className="size-4" />
                                Add
                            </Button>
                        }
                    />
                </div>
            )}
            {settings.enabled && (
                <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium">Notify for these action types</Label>
                    <MultiSelect
                        options={EVENT_TYPE_OPTIONS.map((option) => ({
                            id: option.value,
                            label: option.label,
                        }))}
                        selectedIds={settings.actionTypes}
                        onSelect={(ids) => handleSelectEventTypes(ids as RunHistoryActionType[])}
                        placeholder="Select event types..."
                        searchPlaceholder="Search event types..."
                        emptyMessage="No event types found."
                        displayText={(count) =>
                            count > 0
                                ? `${count} event type${count !== 1 ? 's' : ''} selected`
                                : "Select event types..."
                        }
                        renderItem={(option) => {
                            const eventOption = EVENT_TYPE_OPTIONS.find((opt) => opt.value === option.id);
                            return (
                                <span className="flex items-center gap-2">
                                    {eventOption?.icon}
                                    {option.label}
                                </span>
                            );
                        }}
                        renderBadge={(option) => {
                            const eventOption = EVENT_TYPE_OPTIONS.find((opt) => opt.value === option.id);
                            return (
                                <span className="flex items-center gap-1">
                                    {eventOption?.icon}
                                    {option.label}
                                </span>
                            );
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
];

export default AgentNotificationSettings;