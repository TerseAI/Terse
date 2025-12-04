import { Switch } from "../../components/ui/switch";
import { useNotificationDestinations } from "../../hooks/api/useNotificationDestinations";
import { useState } from "react";
import { NotificationDestination, NotificationDestinationType, SlackNotificationDestination } from "../../shared/Notifications";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Skeleton } from "../../components/ui/skeleton";
import { formatMPIMChannelName } from "../../components/SlackChannelSelector";
import { RunHistoryActionType } from "../../shared/RunHistoryTypes";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Check, ChevronsUpDown, X, Plus, Pencil, Trash2, Eye } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";

function ChannelNotificationSettings({ channelId }: { channelId: string | null }) {
    const [isActive, setIsActive] = useState(false);
    const [selectedDestination, setSelectedDestination] = useState<NotificationDestination | null>(null);
    const [selectedEventTypes, setSelectedEventTypes] = useState<RunHistoryActionType[]>([]);
    
    if (!channelId) {
        return null;
    }

    const onSelect = (destination: NotificationDestination) => {
        setSelectedDestination(destination);
        console.log(destination);
    }
    const onSelectEventTypes = (eventTypes: RunHistoryActionType[]) => {
        setSelectedEventTypes(eventTypes);
        console.log(eventTypes);
    }

    return (
        <div className="flex flex-col gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            {isActive && (
                <div className="flex flex-col gap-2">
                    <h2 className="text-lg">Notification Destinations</h2>
                    <SelectNotificationDestinations selectedDestination={selectedDestination} onSelect={onSelect} />
                    <SelectEventTypes selectedEventTypes={selectedEventTypes} onSelect={onSelectEventTypes} />
                </div>
            )}
        </div>
    )
}

function SelectNotificationDestinations({ selectedDestination, onSelect }: { selectedDestination: NotificationDestination | null, onSelect: (destination: NotificationDestination) => void }) {
    const { notificationDestinations, isValidating } = useNotificationDestinations();

    if (isValidating) {
        return <Skeleton className="w-full h-10" />;
    }

    const slackDestinations = notificationDestinations?.filter((destination) => destination.type === NotificationDestinationType.SLACK) as SlackNotificationDestination[];

    return (
        <Select value={selectedDestination?.id} onValueChange={(value) => onSelect(notificationDestinations?.find((destination) => destination.id === value) as NotificationDestination)}>
            <SelectTrigger>
                <SelectValue placeholder="Select a notification destination" />
            </SelectTrigger>
            <SelectContent>
                {slackDestinations?.map((destination) => (
                    <SelectItem key={destination.id} value={destination.id}>{`#${formatMPIMChannelName(destination.slackChannelName || '')}`}</SelectItem>
                ))}
            </SelectContent>
        </Select>
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