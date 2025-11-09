import { BackendProvider } from "@/services/backend";
import { Hash } from "lucide-react";
import { SlackChannelsResponse } from "@/shared/types";
import { useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Integration } from "@/context/Integrations";
import { formatIntegrationDisplay } from "@/utility/IntegrationFormatters";
import { getIntegrationInstances } from "@/utility/IntegrationUtils";
import { IntegrationsStatus } from "@/shared/types";
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { useOAuthUrl } from "./helpers/useOAuthUrl";
import { CountDisplay } from "./helpers/CountDisplay";
import { cn } from "@/lib/utils";

function SlackIntegrationCard({ integrationStatus, integrationId, className }: { integrationStatus: IntegrationsStatus, integrationId: string, className?: string }) {
    const [channelsResponse, setChannelsResponse] = useState<SlackChannelsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const oauthUrl = useOAuthUrl(Integration.SLACK);

    const slackInstances = getIntegrationInstances(integrationStatus.integrations, Integration.SLACK);
    const currentInstance = slackInstances.find(instance => instance.id === integrationId) || slackInstances[0];
    const teamName = formatIntegrationDisplay(currentInstance, Integration.SLACK);

    useEffect(() => {
        setIsLoading(true);
        const fetchChannels = async () => {
            try {
                const response: SlackChannelsResponse = await BackendProvider.getSlackChannels(integrationId);
                setChannelsResponse(response);
            } catch (error) {
                console.error('Error fetching Slack channels:', error);
                setChannelsResponse(null);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChannels();
    }, [integrationId]);

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={Integration.SLACK} />
            <CardContent>
                <SlackCardContent 
                    teamName={teamName} 
                    channelsResponse={channelsResponse} 
                    isLoading={isLoading} 
                />
            </CardContent>
            <IntegrationCardFooter oauthUrl={oauthUrl} />
        </Card>
    )
}

function SlackCardContent({ 
    teamName, 
    channelsResponse, 
    isLoading 
}: { 
    teamName: string | null;
    channelsResponse: SlackChannelsResponse | null;
    isLoading: boolean;
}) {
    const channelCount = channelsResponse?.channels?.length || 0;
    const availableChannels = channelsResponse?.channels?.filter(ch => !ch.isArchived).length || 0;

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

