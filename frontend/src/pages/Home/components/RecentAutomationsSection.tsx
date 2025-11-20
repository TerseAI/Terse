import { Card, CardContent } from "../../../components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { Settings, Plus } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { AutomationCard } from "./AutomationCard";
import { Automation } from "../../../shared/types";
import { useNavigate } from "react-router-dom";

interface RecentAutomationsSectionProps {
    isLoading: boolean;
    automations: (Automation & { lastEdited: string; lastEventProcessedAt: string })[];
}

export function RecentAutomationsSection({ isLoading, automations }: RecentAutomationsSectionProps) {
    const navigate = useNavigate();

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Recently Edited Automations</h2>
            {isLoading ? (
                <Card>
                    <CardContent className="py-12">
                        <div className="text-center text-muted-foreground">Loading...</div>
                    </CardContent>
                </Card>
            ) : automations.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {automations.map((automation) => (
                        <AutomationCard key={automation.id} automation={automation} />
                    ))}
                </div>
            ) : (
                <Empty className="border-0">
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Settings className="text-primary" />
                        </EmptyMedia>
                        <EmptyTitle>No automations yet</EmptyTitle>
                        <EmptyDescription>
                            Create your first automation to start automating your workflow
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            variant="default"
                            onClick={() => navigate('/app/automations/new')}
                        >
                            <Plus className="h-4 w-4" />
                            Create Automation
                        </Button>
                    </EmptyContent>
                </Empty>
            )}
        </div>
    );
}

