import { PlusIcon } from "lucide-react"
import { Button } from "../ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog"
import { useSlackIntegrations } from "../../hooks/api/useSlackIntegrations"
import { Skeleton } from "../ui/skeleton"
import DropdownSelect, { StatusOption } from "../ui/DropdownSelect"
import { useState } from "react"
import { useOAuthConnection } from "../../hooks/useOAuthConnection"
import { IntegrationType } from "../../shared/Integrations"
import { useOAuthSuccessListener } from "../../hooks/useOAuthSuccessListener"
import { BackendProvider } from "../../services/backend"
import { CreateNotificationDestinationRequest, NotificationDestinationType } from "../../shared/Notifications"
import { toast } from "sonner"
import { useSlackChannels } from "../../hooks/api/useSlackChannels"
import { Checkbox } from "@/components/ui/checkbox"
import { SlackChannel } from "../../shared/types"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select"
import { formatMPIMChannelName } from "../SlackChannelSelector"
import { mutate } from "swr"
import { notificationDestinationsKey } from "../../shared/InvalidationKeys"

export function AddNotificationDestination() {
    return (
        <div>
            <AddNotificationDestinationDialog />
        </div>
    )
}

function AddNotificationDestinationDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <PlusIcon />
                    Add Notification Channel
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Notification Destination</DialogTitle>
                    <DialogDescription>Add a notification channel to be notified when a background agent makes a change.</DialogDescription>

                    <SelectSlackDestination onSuccess={() => setOpen(false)} />
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}

interface SelectSlackDestinationProps {
    onSuccess?: () => void;
}

function SelectSlackDestination({ onSuccess }: SelectSlackDestinationProps) {
    const { integrations, isLoading } = useSlackIntegrations();
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(undefined);
    const { connect: connectOAuth } = useOAuthConnection(IntegrationType.SLACK);
    const [isConnecting, setIsConnecting] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(undefined);
    const [selectedChannelName, setSelectedChannelName] = useState<string | undefined>(undefined);
    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);

    async function saveDestination() {
        setValidationError(null);

        if (!selectedIntegrationId) {
            setValidationError("Please select a Slack workspace");
            return;
        }

        if (!selectedChannelId) {
            setValidationError("Please select a channel to receive notifications");
            return;
        }

        setIsSaving(true);
        try {
            const payload: CreateNotificationDestinationRequest = {
                type: NotificationDestinationType.SLACK,
                integrationId: selectedIntegrationId,
                slackChannelId: selectedChannelId,
                slackChannelName: selectedChannelName,
            };
            await BackendProvider.createNotificationDestination(payload);
            mutate(notificationDestinationsKey());
            toast.success("Notification destination added successfully");
            onSuccess?.();
        } catch (error) {
            console.error("Failed to save notification destination:", error);
            toast.error("Failed to add notification destination. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    useOAuthSuccessListener(mutate, () => {
        setIsConnecting(false);
    });

    if (isLoading || isConnecting) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    if (integrations.length === 0) {
        return (
            <div>No Slack integrations found. <Button variant="link" onClick={() => {
                setIsConnecting(true);
                connectOAuth();
            }}>{isConnecting ? 'Connecting...' : 'Connect a Slack integration'}</Button></div>
        );
    }

    const options: StatusOption[] = integrations.map((integration) => ({
        label: integration.teamName || 'Unknown Workspace',
        value: integration.id,
    }));


    let selectedOption = options.find(option => option.value === selectedIntegrationId);
    if (!selectedIntegrationId && !selectedOption && options.length == 1) {
        const defaultIntegration = options[0];
        setSelectedIntegrationId(defaultIntegration.value);
        selectedOption = defaultIntegration;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-2 items-center">
                <p>Send notifications to:</p>
                <DropdownSelect
                    statusOptions={options}
                    selectedOption={selectedOption}
                    setSelected={setSelectedIntegrationId}
                    additionalAction={{
                        label: 'Connect Another Slack Workspace',
                        onClick: connectOAuth
                    }}
                    modal={false}
                />
            </div>
            {selectedIntegrationId && (
                <SelectSlackDestinationForm integrationId={selectedIntegrationId} onSelectChannel={(channelId, channelName) => {
                    setSelectedChannelId(channelId);
                    setSelectedChannelName(channelName);
                }} />
            )}

            {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
            )}

            <Button onClick={saveDestination} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
        </div>
    )
}

function SelectSlackDestinationForm({ integrationId, onSelectChannel }: { integrationId: string, onSelectChannel: (channelId: string, channelName: string) => void }) {
    const [sendAsDirectMessage, setSendAsDirectMessage] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(undefined);
    const {
        channels,
        isLoading,
    } = useSlackChannels(integrationId);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    const selectedChannelName = selectedChannelId 
        ? channels.find(ch => ch.id === selectedChannelId)?.name 
        : undefined;

    const handleClearSelection = () => {
        setSelectedChannelId(undefined);
        setSendAsDirectMessage(false);
    };

    const handleSelectChannel = (channelId: string, channelName: string) => {
        setSelectedChannelId(channelId);
        onSelectChannel(channelId, channelName);
    };

    // Show selected channel with option to change
    if (selectedChannelId) {
        return (
            <div className="flex flex-row gap-2 items-center">
                <p>in the channel:</p>
                <span className="font-medium">{formatMPIMChannelName(selectedChannelName || '')}</span>
                <Button variant="link" className="p-0 h-auto text-muted-foreground" onClick={handleClearSelection}>
                    (change)
                </Button>
            </div>
        );
    }

    // Show DM selection with option to change
    if (sendAsDirectMessage) {
        return (
            <div className="flex flex-row gap-2 items-center">
                <p>as a</p>
                <span className="font-medium">direct message</span>
                <Button variant="link" className="p-0 h-auto text-muted-foreground" onClick={handleClearSelection}>
                    (change)
                </Button>
            </div>
        );
    }

    // Show both options when nothing is selected
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-2 items-center">
                <p>in the channel:</p>
                <ChannelSelector channels={channels} selectedChannelId={selectedChannelId} onChannelSelect={handleSelectChannel} />
            </div>

            <div className="flex flex-row gap-2 items-center">
                <p>or</p>
                <Checkbox 
                    checked={sendAsDirectMessage} 
                    onCheckedChange={(checked) => setSendAsDirectMessage(checked === 'indeterminate' ? false : checked)} 
                />
                <span className="text-sm text-foreground">Send as direct message</span>
            </div>
        </div>
    );
}

function ChannelSelector({ channels, selectedChannelId, onChannelSelect }: { channels: SlackChannel[], selectedChannelId: string | undefined, onChannelSelect: (channelId: string, channelName: string) => void }) {
    const publicChannels = channels.filter(ch => !ch.isPrivate && !ch.isArchived);
    const privateChannels = channels.filter(ch => ch.isPrivate && !ch.isArchived);

    return (
        <Select value={selectedChannelId} onValueChange={(value) => onChannelSelect(value, channels.find(ch => ch.id === value)?.name || '')}>
            <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select a channel" />
            </SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectLabel>Public Channels</SelectLabel>
                    {publicChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                            #{channel.name}
                        </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                    <SelectLabel>Private Channels</SelectLabel>
                    {privateChannels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                            🔒 {channel.isMPIM ? formatMPIMChannelName(channel.name) : `#${channel.name}`}
                        </SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    )
}