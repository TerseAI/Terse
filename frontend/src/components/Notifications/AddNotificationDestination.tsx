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
import { SlackChannelSelector } from "../SlackChannelSelector"
import { BackendProvider } from "../../services/backend"
import { CreateNotificationDestinationRequest, NotificationDestinationType } from "../../shared/Notifications"
import { toast } from "sonner"

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
    const { integrations, isLoading, mutate } = useSlackIntegrations();
    const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | undefined>(undefined);
    const { connect: connectOAuth } = useOAuthConnection(IntegrationType.SLACK);
    const [isConnecting, setIsConnecting] = useState(false);
    const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>(undefined);
    const [listenToUserDms, setListenToUserDms] = useState(false);
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
            };
            await BackendProvider.createNotificationDestination(payload);
            mutate();
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
                <div className="mt-3 pt-3 border-t border-border">
                    <SlackChannelSelector
                        integrationId={selectedIntegrationId}
                        selectedChannelId={selectedChannelId}
                        listenToUserDms={listenToUserDms}
                        onSelect={(channelId, channelName) => {
                            setSelectedChannelId(channelId);
                            setValidationError(null);
                        }}
                        onListenToUserDmsChange={(listenToUserDms) => {
                            setListenToUserDms(listenToUserDms);
                        }}
                    />
                </div>
            )}

            {validationError && (
                <p className="text-sm text-destructive">{validationError}</p>
            )}

            <Button onClick={saveDestination} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
        </div>
    )
}