import { Hash, MessageSquare } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { IntegrationType, SlackIntegration } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { IntegrationItem } from "./helpers/IntegrationItem";
import { CountDisplay } from "./helpers/CountDisplay";
import { useSlackChannels } from "@/hooks/api/useSlackChannels";
import { useSlackIntegrations } from "@/hooks/api/useSlackIntegrations";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";
import { useState } from "react";
import { SlackConnectionOptions } from "./helpers/SlackConnectionOptions";
import { BackendProvider } from "@/services/backend";

function SlackIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const [showConnectionOptions, setShowConnectionOptions] = useState(false);
    const [isBotUser, setIsBotUser] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const { integrations, isLoading: integrationsLoading } = useSlackIntegrations();
    const handleConnectClick = () => {
        setShowConnectionOptions(true);
    };

    const handleBack = () => {
        setShowConnectionOptions(false);
    };

    const connect = async () => {
        setIsConnecting(true);
        try {
            const installationDetails = await BackendProvider.getIntegrationInstallationDetails(IntegrationType.SLACK, { isBotUser }, stateToken);

            if (installationDetails?.oauthUrl) {
                window.open(installationDetails.oauthUrl, 'oauth-popup', 'width=600,height=700');
                // Return to previous page after opening OAuth popup
                setShowConnectionOptions(false);
            } else {
                console.error('OAuth URL not available for this integration type');
            }
        } catch (error) {
            console.error('Error initiating OAuth:', error);
        } finally {
            setIsConnecting(false);
        }
    }

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.SLACK} isActive={isActive} compact={compact} />
            {!compact && (
                <CardContent>
                    {showConnectionOptions ? (
                        <SlackConnectionOptions
                            isBotUser={isBotUser}
                            setIsBotUser={setIsBotUser}
                            onBack={handleBack}
                            onConnect={connect}
                            isConnecting={isConnecting}
                        />
                    ) : (
                        <SlackCardContent
                            integrations={integrations}
                            isLoading={integrationsLoading}
                        />
                    )}
                </CardContent>
            )}
            {!showConnectionOptions && (
                <IntegrationCardFooter
                    connect={handleConnectClick}
                    isConnecting={isConnecting}
                    buttonText="Connect Another Slack"
                    compact={compact}
                />
            )}
        </Card>
    )
}

function SlackCardContent({
    integrations,
    isLoading
}: {
    integrations: SlackIntegration[];
    isLoading: boolean;
}) {
    if (isLoading && integrations.length === 0) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Slack integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Slack workspace to get started</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {integrations.map((integration) => (
                <SlackIntegrationItem integration={integration} key={integration.id} />
            ))}
        </div>
    );
}

function SlackIntegrationItem({ integration }: { integration: SlackIntegration }) {
    const { channels, isLoading: channelsLoading } = useSlackChannels(integration.id);
    const channelCount = channels.length;
    const availableChannels = channels.filter(ch => !ch.isArchived).length;
    return (
        <IntegrationItem
            key={integration.id}
            icon={<MessageSquare className="w-4 h-4" />}
            title={`${integration.teamName || 'Unknown Workspace'}${integration.isBotUser === false ? ' - User' : ' - Bot'}`}
            description={
                <span className="flex items-center gap-2">
                    <Hash className="size-3" />
                    <ChannelsCount
                        channelCount={availableChannels}
                        totalChannels={channelCount}
                        isLoading={channelsLoading}
                    />
                </span>
            }
        />
    )
}

function ChannelsCount({
    channelCount,
    totalChannels,
    isLoading
}: {
    channelCount: number;
    totalChannels: number;
    isLoading: boolean;
}) {
    const additionalInfo = totalChannels > channelCount
        ? `(${totalChannels - channelCount} archived)`
        : undefined;

    return (
        <CountDisplay
            count={channelCount}
            singular="channel available"
            plural="channels available"
            isLoading={isLoading}
            skeletonWidth="w-[100px]"
            additionalInfo={additionalInfo}
        />
    )
}

export default SlackIntegrationCard;

