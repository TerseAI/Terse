import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Clock } from "lucide-react";
import { AppsList } from "../../../components/Automation/AppsList";
import { Automation } from "../../../shared/types";
import { useNavigate } from "react-router-dom";

export interface AutomationCardProps {
    automation: Automation & { lastEdited: string; lastEventProcessedAt: string };
}

export function AutomationCard({ automation }: AutomationCardProps) {
    const navigate = useNavigate();

    const handleClick = () => {
        navigate(`/app/automations/${automation.id}`);
    };

    return (
        <Card 
            className="hover:shadow-md transition-shadow relative cursor-pointer"
            onClick={handleClick}
        >
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg font-semibold truncate mb-2">
                            {automation.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                                variant={automation.isActive ? "default" : "outline"}
                                className="text-xs"
                            >
                                {automation.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>Edited {automation.lastEdited}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <AppsList automation={automation} />
            </CardContent>
            <div className="absolute bottom-4 right-6 text-xs text-muted-foreground">
                <span className="font-medium">Last event: </span>
                <span>{automation.lastEventProcessedAt}</span>
            </div>
        </Card>
    );
}

