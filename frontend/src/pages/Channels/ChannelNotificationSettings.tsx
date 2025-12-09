import { Switch } from "../../components/ui/switch";
import { useState } from "react";
import { RunHistoryActionType } from "../../shared/RunHistoryTypes";
import { ChannelNotificationSettings as ChannelNotificationSettingsType } from "../../shared/types";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Check, ChevronsUpDown, X, Plus, Pencil, Trash2, Eye, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";
import { Label } from "../../components/ui/label";
import { useNotificationDestinations } from "../../hooks/api/useNotificationDestinations";
import { AddNotificationDestination } from "../../components/Notifications/AddNotificationDestination";

export type ChannelNotificationSettingsProps = {
    settings: ChannelNotificationSettingsType;
    onChange: (settings: ChannelNotificationSettingsType) => void;
};

function ChannelNotificationSettings({ settings, onChange }: ChannelNotificationSettingsProps) {
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
                    <SelectEventTypes 
                        selectedEventTypes={settings.actionTypes} 
                        onSelect={handleSelectEventTypes} 
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
    { value: "read", label: "Read", icon: <Eye className="h-4 w-4" /> },
];

function SelectEventTypes({ selectedEventTypes, onSelect }: { selectedEventTypes: RunHistoryActionType[], onSelect: (eventTypes: RunHistoryActionType[]) => void }) {
    const [open, setOpen] = useState(false);

    const handleToggleEventType = (eventType: RunHistoryActionType) => {
        const isSelected = selectedEventTypes.includes(eventType);
        if (isSelected) {
            onSelect(selectedEventTypes.filter(type => type !== eventType));
        } else {
            onSelect([...selectedEventTypes, eventType]);
        }
    };

    const handleRemoveEventType = (eventType: RunHistoryActionType) => {
        onSelect(selectedEventTypes.filter(type => type !== eventType));
    };

    const selectedOptions = EVENT_TYPE_OPTIONS.filter(option =>
        selectedEventTypes.includes(option.value)
    );

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        <span className="truncate">
                            {selectedOptions.length > 0
                                ? `${selectedOptions.length} event type${selectedOptions.length !== 1 ? 's' : ''} selected`
                                : "Select event types..."}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                    <Command>
                        <CommandInput placeholder="Search event types..." />
                        <CommandList>
                            <CommandEmpty>No event types found.</CommandEmpty>
                            <CommandGroup>
                                {EVENT_TYPE_OPTIONS.map((option) => {
                                    const isSelected = selectedEventTypes.includes(option.value);
                                    return (
                                        <CommandItem
                                            key={option.value}
                                            value={option.value}
                                            onSelect={() => handleToggleEventType(option.value)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    isSelected ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className="flex items-center gap-2">
                                                {option.icon}
                                                {option.label}
                                            </span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {selectedOptions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {selectedOptions.map((option) => (
                        <Badge
                            key={option.value}
                            variant="secondary"
                            className="pr-1"
                        >
                            <span className="flex items-center gap-1">
                                {option.icon}
                                {option.label}
                            </span>
                            <button
                                onClick={() => handleRemoveEventType(option.value)}
                                className="ml-1 rounded-full hover:bg-secondary-foreground/20 p-0.5"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleRemoveEventType(option.value);
                                    }
                                }}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ChannelNotificationSettings;