import { Hash, MessageSquare } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { SlackChannel } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { IntegrationItem } from "./helpers/IntegrationItem";
import { useOAuthConnection } from "@/hooks/useOAuthConnection";
import { CountDisplay } from "./helpers/CountDisplay";
import { useSlackChannels } from "@/hooks/api/useSlackChannels";
import { useSlackIntegrations } from "@/hooks/api/useSlackIntegrations";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

function SlackIntegrationCard({ className, isActive = true }: { className?: string; isActive?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection(IntegrationType.SLACK);
    const { integrations, isLoading: integrationsLoading } = useSlackIntegrations();
    const firstIntegrationId = integrations[0]?.id;
    const { channels, isLoading: channelsLoading } = useSlackChannels(firstIntegrationId || null);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.SLACK} isActive={isActive} />
            <CardContent>
                <SlackCardContent 
                    integrations={integrations}
                    channels={channels} 
                    isLoading={integrationsLoading || channelsLoading} 
                />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function SlackCardContent({ 
    integrations,
    channels, 
    isLoading 
}: { 
    integrations: Array<{ id: string; teamId?: string; teamName?: string }>;
    channels: SlackChannel[];
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

    const channelCount = channels.length;
    const availableChannels = channels.filter(ch => !ch.isArchived).length;

    return (
        <div className="space-y-2">
            {integrations.map((integration) => (
                <IntegrationItem
                    key={integration.id}
                    icon={<MessageSquare className="w-4 h-4" />}
                    title={integration.teamName || 'Unknown Workspace'}
                    description={
                        <span className="flex items-center gap-2">
                            <Hash className="size-3" />
                            <ChannelsCount 
                                channelCount={availableChannels} 
                                totalChannels={channelCount}
                                isLoading={isLoading} 
                            />
                        </span>
                    }
                />
            ))}
        </div>
    );
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

