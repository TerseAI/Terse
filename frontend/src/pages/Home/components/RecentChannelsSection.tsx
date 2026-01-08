import { Card, CardContent } from "../../../components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { Settings, Plus } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { ChannelCard } from "./ChannelCard";
import { Channel } from "../../../shared/types";
import { useNavigate } from "react-router-dom";

interface RecentChannelsSectionProps {
    isLoading: boolean;
    channels: (Channel & { lastEdited: string; lastEventProcessedAt: string })[];
}

export function RecentChannelsSection({ isLoading, channels }: RecentChannelsSectionProps) {
    const navigate = useNavigate();

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Recently Edited Channels</h2>
            {isLoading ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">Loading...</div>
                    </CardContent>
                </Card>
            ) : channels.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {channels.map((channel) => (
                        <ChannelCard key={channel.id} channel={channel} />
                    ))}
                </div>
            ) : (
                <Empty className="border-0">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Settings className="text-primary" />
                        </EmptyMedia>
                        <EmptyTitle>No channels yet</EmptyTitle>
                        <EmptyDescription>
                            Create your first channel to start automating your workflow
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            variant="default"
                            onClick={() => navigate('/app/channels/setup')}
                        >
                            <Plus className="h-4 w-4" />
                            Create Channel
                        </Button>
                    </EmptyContent>
                </Empty>
            )}
        </div>
    );
}

