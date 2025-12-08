import { Plus, AlertTriangleIcon, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import DropdownSelect from '../ui/DropdownSelect';
import { SlackChannelSelector } from '../SlackChannelSelector';
import { IntegrationType, SlackIntegration as SlackIntegrationType } from "@/shared/Integrations"
import { SlackConfig } from '../../shared/Configs';
import { InputConfigSelectorProps } from './types';
import { useSlackIntegrations } from '@/hooks/api/useSlackIntegrations';
import { useOAuthConnection } from '@/hooks/useOAuthConnection';
import { useIntegrationId } from '@/hooks/useIntegrationId';
import { StatusOption } from '../ui/DropdownSelect';
import { ConfigType } from '../../shared/Configs';
import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"


/**
 *  Need to think through the connection experience:
 *  - Step 1: You click Connect Slack
 *  - Step 2: It transitions the card into a connecting app state. the
 *  - card now has a section with two radio buttons:
 *    - "Connect Slack as: "
 *        - "A Bot User"
 *           Access limited to channels you invite the bot to.
 *        - "A User"
 *           Full access. The automation acts as the user. 
 *           Required if you want to automate your direct messages.
 *        Select one: oauth triggers
 *  
 */

interface SlackConnectionOptionsProps {
    isBotUser: boolean;
    setIsBotUser: (value: boolean) => void;
    onBack: () => void;
    onConnect: () => void;
    isConnecting: boolean;
}

function SlackConnectionOptions({
    isBotUser,
    setIsBotUser,
    onBack,
    onConnect,
    isConnecting
}: SlackConnectionOptionsProps) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBack}
                        className="h-auto p-1 -ml-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h3 className="font-medium text-base">
                        Connect Slack as:
                    </h3>
                </div>
                <RadioGroup
                    className="flex flex-col gap-3 p-1"
                    value={isBotUser ? "botUser" : "user"}
                    onValueChange={(value) => setIsBotUser(value === "botUser")}
                >
                    <div className="flex items-start space-x-2">
                        <RadioGroupItem value="botUser" id="botUser" className="mt-0.5" />
                        <Label htmlFor="botUser" className="text-sm">
                            <span>A Bot User - </span>
                            <span className="italic">Access is limited to channels you invite the bot to.</span>
                        </Label>
                    </div>
                    <div className="flex items-start space-x-2">
                        <RadioGroupItem value="user" id="user" className="mt-0.5" />
                        <Label htmlFor="user" className="text-sm">
                            <span>A User - </span>
                            <span className="italic">The automation acts as you</span>
                        </Label>
                    </div>
                </RadioGroup>
            </div>
            <Button
                className="max-w-xs"
                onClick={onConnect}
                disabled={isConnecting}
            >
                {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
        </div>
    );
}

export function SlackIntegration({
    input,
    variant,
    setConfig
}: InputConfigSelectorProps) {
    const { integrations, isLoading } = useSlackIntegrations();

    // Connection options
    const [showConnectionOptions, setShowConnectionOptions] = useState(false);
    const [isBotUser, setIsBotUser] = useState(false);
    const { connect: connectOAuth, isConnecting: isOAuthConnecting } = useOAuthConnection<IntegrationType.SLACK>(IntegrationType.SLACK, { isBotUser });


    const currentConfig = input.config as SlackConfig | undefined;
    const [selectedIntegrationId, setSelectedIntegrationId] = useIntegrationId(currentConfig, ConfigType.SLACK);

    function onSelect(value: string) {
        const integration = integrations.find((integration: SlackIntegrationType) => integration.id === value);
        if (integration) {
            setSelectedIntegrationId(integration.id);
        }
    }

    function onClickConnect() {
        setIsBotUser(true);
        setShowConnectionOptions(true);
    }

    if (isLoading) {
        return (
            <div className="max-w-xs flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent"></div>
                Loading connections...
            </div>
        );
    }

    if (showConnectionOptions) {
        return (
            <SlackConnectionOptions
                isBotUser={isBotUser}
                setIsBotUser={setIsBotUser}
                onBack={() => setShowConnectionOptions(false)}
                onConnect={connectOAuth}
                isConnecting={isOAuthConnecting}
            />
        );
    }


    if (integrations.length === 0) {
        if (variant === 'card') {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Slack
                </div>
            );
        }
        return (
            <div className="max-w-xs flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">
                    No Slack accounts connected
                </div>
                <Button
                    onClick={onClickConnect}
                    disabled={isOAuthConnecting}
                >
                    <Plus className="w-4 h-4" />
                    {isOAuthConnecting ? 'Connecting...' : `Connect Slack`}
                </Button>
            </div>
        );
    }

    const connectionSelections: StatusOption[] = integrations.map((integration: SlackIntegrationType) => ({
        label: integration.teamName || 'Unknown Workspace',
        value: integration.id
    }));

    let selectedOption = connectionSelections.find(option => option.value === selectedIntegrationId);
    if (!selectedIntegrationId && !selectedOption && connectionSelections.length == 1) {
        const defaultIntegration = connectionSelections[0];
        setSelectedIntegrationId(defaultIntegration.value);
        selectedOption = defaultIntegration;
    } else if (!selectedOption) {
        selectedOption = connectionSelections[0];
    }

    // Card variant: compact view
    if (variant === 'card') {
        const isComplete = currentConfig?.isComplete();
        if (!isComplete) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Select channel or DMs
                </div>
            );
        }
        return (
            <div className="text-sm">
                {selectedOption ? selectedOption.label : 'No connection selected'}
            </div>
        );
    }

    // Dialog variant: full view
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
                <label className="font-medium">
                    Slack Workspace
                </label>
                <DropdownSelect
                    statusOptions={connectionSelections}
                    selectedOption={selectedOption}
                    setSelected={onSelect}
                    placeholder="No connection selected"
                />
            </div>

            <Button
                onClick={connectOAuth}
                disabled={isOAuthConnecting}
                variant="outline"
            >
                <Plus className="w-4 h-4" />
                {isOAuthConnecting ? 'Connecting...' : "Connect Another Slack"}
            </Button>

            {/* Slack-specific channel selector */}
            {selectedIntegrationId && (
                <div className="mt-3 pt-3 border-t border-border">
                    {!currentConfig?.isComplete() && (
                        <p className="text-sm text-muted-foreground mb-3">
                            Select a channel or enable DM listening
                        </p>
                    )}
                    <SlackChannelSelector
                        integrationId={selectedIntegrationId}
                        selectedChannelId={currentConfig?.channelId}
                        listenToUserDms={currentConfig?.listenToUserDms}
                        onSelect={(channelId, channelName) => {
                            const hasChannel = channelId && channelId.trim() !== '';
                            const updatedConfig = new SlackConfig(
                                selectedIntegrationId,
                                hasChannel ? channelId : undefined,
                                hasChannel ? channelName : undefined,
                                hasChannel ? false : currentConfig?.listenToUserDms
                            );
                            setConfig(updatedConfig);
                        }}
                        onListenToUserDmsChange={(listenToUserDms) => {
                            const updatedConfig = new SlackConfig(
                                selectedIntegrationId,
                                listenToUserDms ? undefined : currentConfig?.channelId,
                                listenToUserDms ? undefined : currentConfig?.channelName,
                                listenToUserDms
                            );
                            setConfig(updatedConfig);
                        }}
                    />
                </div>
            )}
        </div>
    );
}

