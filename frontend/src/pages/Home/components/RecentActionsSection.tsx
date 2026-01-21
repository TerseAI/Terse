import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { PlayCircle } from "lucide-react";
import { ActionItem } from "./ActionItem";
import { RunHistoryAction } from "../../../shared/RunHistoryTypes";

interface RecentActionsSectionProps {
    recentActions: (RunHistoryAction & { timestamp: string; agentName: string })[];
}

export function RecentActionsSection({ recentActions }: RecentActionsSectionProps) {
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Recently Run Actions</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                    {recentActions.length > 0 ? (
                        <ScrollArea className="h-[300px]">
                            <div className="space-y-4 pr-4">
                                {recentActions.map((action, index) => (
                                    <ActionItem key={index} action={action} />
                                ))}
                            </div>
                        </ScrollArea>
                    ) : (
                        <Empty className="h-[300px] border-0">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <PlayCircle className="text-primary" />
                                </EmptyMedia>
                                <EmptyTitle>No actions yet</EmptyTitle>
                                <EmptyDescription>
                                    Actions taken by your agents will appear here once they start processing events
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

