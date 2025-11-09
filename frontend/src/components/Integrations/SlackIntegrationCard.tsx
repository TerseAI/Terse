import { Hash } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Integration } from "@/context/Integrations";
import { formatIntegrationDisplay } from "@/utility/IntegrationFormatters";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus, SlackChannel } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { CountDisplay } from "./helpers/CountDisplay";
import { useSlackChannels } from "@/hooks/api/useSlackChannels";

function SlackIntegrationCard({ integrationStatus, integrationId, className }: { integrationStatus: IntegrationsStatus, integrationId: string, className?: string }) {
    const oauthUrl = useOAuthUrl(Integration.SLACK);
    const { channels, isLoading } = useSlackChannels(integrationId);

    const slackInstances = getIntegrationInstances(integrationStatus.integrations, Integration.SLACK);
    const currentInstance = slackInstances.find(instance => instance.id === integrationId) || slackInstances[0];
    const teamName = formatIntegrationDisplay(currentInstance, Integration.SLACK);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={Integration.SLACK} />
            <CardContent>
                <SlackCardContent 
                    teamName={teamName} 
                    channels={channels} 
                    isLoading={isLoading} 
                />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
        </Card>
    )
}

function SlackCardContent({ 
    teamName, 
    channels, 
    isLoading 
}: { 
    teamName: string | null;
    channels: SlackChannel[];
    isLoading: boolean;
}) {
    const channelCount = channels.length;
    const availableChannels = channels.filter(ch => !ch.isArchived).length;

    return (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
                <span>{teamName || 'Unknown Workspace'}</span>
            </div>
            <div className="flex items-center gap-2">
                <Hash className="size-4" />
                <ChannelsCount 
                    channelCount={availableChannels} 
                    totalChannels={channelCount}
                    isLoading={isLoading} 
                />
            </div>
        </div>
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

