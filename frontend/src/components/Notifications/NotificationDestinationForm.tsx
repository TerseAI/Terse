import { Button } from "../ui/button"
import { useSlackIntegrations } from "../../hooks/api/useSlackIntegrations"
import { Skeleton } from "../ui/skeleton"
import DropdownSelect, { StatusOption } from "../ui/DropdownSelect"
import { useState, useEffect } from "react"
import { IntegrationType, SlackIntegration } from "../../shared/Integrations"
import { useOAuthSuccessListener } from "../../hooks/useOAuthSuccessListener"
import { BackendProvider } from "../../services/backend"
import { CreateNotificationDestinationRequest, NotificationDestinationType, SlackNotificationDestination, NotificationDestination } from "../../shared/Notifications"
import { toast } from "sonner"
import { useSlackChannels } from "../../hooks/api/useSlackChannels"
import { Checkbox } from "@/components/ui/checkbox"
import { SlackChannel } from "../../shared/types"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "../ui/select"
import { formatMPIMChannelName } from "../SlackChannelSelector"
import { mutate } from "swr"
import { notificationDestinationsKey } from "../../shared/InvalidationKeys"
import { SlackConnectionOptions } from "../Integrations/helpers/SlackConnectionOptions"

export interface NotificationDestinationFormProps {
    existingDestination?: NotificationDestination;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function NotificationDestinationForm({ existingDestination, onSuccess, onCancel }: NotificationDestinationFormProps) {
    const { integrations, isLoading } = useSlackIntegrations();
    
    // For edit mode with Slack, use the existing integration ID
    const slackDestination = existingDestination?.type === NotificationDestinationType.SLACK 
        ? existingDestination as SlackNotificationDestination 
        : undefined;
    
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(slackDestination?.integrationId);
    const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(slackDestination?.slackChannelId);
    const [selectedChannelName, setSelectedChannelName] = useState<string | undefined>(slackDestination?.slackChannelName);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [showConnectionOptions, setShowConnectionOptions] = useState(false);
    const [isBotUser, setIsBotUser] = useState(true);

    const selectedSlackIntegration = integrations.find(integration => integration.id === selectedIntegrationId);


    const isEditMode = !!existingDestination;

    // Initialize integration selection when integrations load (for new destinations)
    useEffect(() => {
        if (!isEditMode && !selectedIntegrationId && integrations.length === 1) {
            setSelectedIntegrationId(integrations[0].id);
        }
    }, [integrations, isEditMode, selectedIntegrationId]);

    const connectSlack = async () => {
        setIsConnecting(true);
        try {
            const installationDetails = await BackendProvider.getIntegrationInstallationDetails(IntegrationType.SLACK, { isBotUser });
            
            if (installationDetails?.oauthUrl) {
                window.open(installationDetails.oauthUrl, 'oauth-popup', 'width=600,height=700');
                setShowConnectionOptions(false);
            } else {
                console.error('OAuth URL not available for this integration type');
            }
        } catch (error) {
            console.error('Error initiating OAuth:', error);
        } finally {
            setIsConnecting(false);
        }
    };

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
            if (isEditMode) {
                // Update existing destination
                await BackendProvider.updateNotificationDestination({
                    id: existingDestination.id,
                    type: NotificationDestinationType.SLACK,
                    integrationId: selectedIntegrationId,
                    slackChannelId: selectedChannelId,
                    slackChannelName: selectedChannelName,
                } as SlackNotificationDestination);
                toast.success("Notification destination updated successfully");
            } else {
                // Create new destination
                const payload: CreateNotificationDestinationRequest = {
                    type: NotificationDestinationType.SLACK,
                    integrationId: selectedIntegrationId,
                    slackChannelId: selectedChannelId,
                    slackChannelName: selectedChannelName,
                };
                await BackendProvider.createNotificationDestination(payload);
                toast.success("Notification destination added successfully");
            }
            mutate(notificationDestinationsKey());
            onSuccess?.();
        } catch (error) {
            console.error("Failed to save notification destination:", error);
            toast.error(`Failed to ${isEditMode ? 'update' : 'add'} notification destination. Please try again.`);
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

    if (showConnectionOptions) {
        return (
            <SlackConnectionOptions
                isBotUser={isBotUser}
                setIsBotUser={setIsBotUser}
                onBack={() => setShowConnectionOptions(false)}
                onConnect={connectSlack}
                isConnecting={isConnecting}
            />
        );
    }

    if (integrations.length === 0) {
        return (
            <div>No Slack integrations found. <Button variant="link" onClick={() => setShowConnectionOptions(true)}>Connect a Slack integration</Button></div>
        );
    }

    const options: StatusOption[] = integrations.map((integration) => ({
        label: formatIntegrationLabel(integration),
        value: integration.id,
    }));

    const selectedOption = options.find(option => option.value === selectedIntegrationId) || options[0];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-row gap-2 items-center">
                <p>Send notifications to:</p>
                <DropdownSelect
                    statusOptions={options}
                    selectedOption={selectedOption}
                    setSelected={(id) => {
                        setSelectedIntegrationId(id);
                        // Reset channel when workspace changes
                        if (id !== selectedIntegrationId) {
                            setSelectedChannelId(undefined);
                            setSelectedChannelName(undefined);
                        }
                    }}
                    additionalAction={{
                        label: 'Connect Another Slack Workspace',
                        onClick: () => setShowConnectionOptions(true)
                    }}
                    modal={false}
                />
            </div>
            {selectedIntegrationId && (
                <SelectSlackChannelForm 
                    integrationId={selectedIntegrationId}
                    isBotUser={selectedSlackIntegration?.isBotUser}
                    initialChannelId={selectedChannelId}
                    initialChannelName={selectedChannelName}
                    onSelectChannel={(channelId, agentName) => {
                        setSelectedChannelId(channelId);
                        setSelectedChannelName(agentName);
                    }} 
                />
            )}

            {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
            )}

            <div className="flex flex-row gap-2 justify-end">
                {onCancel && (
                    <Button variant="outline" onClick={onCancel}>Cancel</Button>
                )}
                <Button onClick={saveDestination} disabled={isSaving}>
                    {isSaving ? 'Saving...' : (isEditMode ? 'Update' : 'Save')}
                </Button>
            </div>
        </div>
    )
}

interface SelectSlackChannelFormProps {
    integrationId: string;
    isBotUser?: boolean;
    initialChannelId?: string;
    initialChannelName?: string;
    onSelectChannel: (channelId: string, agentName: string) => void;
}

function SelectSlackChannelForm({ integrationId, isBotUser, initialChannelId, initialChannelName, onSelectChannel }: SelectSlackChannelFormProps) {
    const [sendAsDirectMessage, setSendAsDirectMessage] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(initialChannelId);
    const [selectedChannelName, setSelectedChannelName] = useState<string | undefined>(initialChannelName);
    const {
        channels,
        isLoading,
    } = useSlackChannels(integrationId);

    // Update local state when initial values change (e.g., when switching workspaces)
    useEffect(() => {
        setSelectedChannelId(initialChannelId);
        setSelectedChannelName(initialChannelName);
    }, [initialChannelId, initialChannelName]);

    if (isLoading) {
        return (
            <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
            </div>
        );
    }

    // Handle case where bot integration has no channels granted
    if (isBotUser && channels.length === 0) {
        return (
            <div className="flex flex-col gap-2 p-3 bg-muted/50 rounded-md border border-border">
                <p className="text-sm text-muted-foreground">
                    No channels available. To send notifications, you need to invite the Terse bot to at least one channel.
                </p>
                <p className="text-sm text-muted-foreground">
                    In Slack, go to a channel and type <code className="px-1.5 py-0.5 bg-muted rounded text-foreground">/invite @Terse</code> to add the bot.
                </p>
            </div>
        );
    }

    const displayChannelName = selectedChannelName || 
        (selectedChannelId ? channels.find(ch => ch.id === selectedChannelId)?.name : undefined);

    const handleClearSelection = () => {
        setSelectedChannelId(undefined);
        setSelectedChannelName(undefined);
        setSendAsDirectMessage(false);
    };

    const handleSelectChannel = (channelId: string, agentName: string) => {
        setSelectedChannelId(channelId);
        setSelectedChannelName(agentName);
        onSelectChannel(channelId, agentName);
    };

    // Show selected channel with option to change
    if (selectedChannelId) {
        return (
            <div className="flex flex-row gap-2 items-center">
                <p>in the channel:</p>
                <span className="font-medium">{formatMPIMChannelName(displayChannelName || '')}</span>
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

function ChannelSelector({ channels, selectedChannelId, onChannelSelect }: { channels: SlackChannel[], selectedChannelId: string | undefined, onChannelSelect: (channelId: string, agentName: string) => void }) {
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

function formatIntegrationLabel(integration: SlackIntegration) {
    const isBotUser = integration.isBotUser === true;
    return `${integration.teamName || 'Unknown Workspace'}${isBotUser ? ' - Bot' : ' - User'}`;
}