import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Zap, Hash, Clock } from "lucide-react";
import { AppsList } from "../components/Automation/AppsList";
import { Automation } from "../shared/types";

function Home() {
    // Mock data
    const metrics = [
        {
            label: "Total events processed",
            value: "12,450",
            change: "+12.5%",
            trend: "up" as const,
            description: "Events processed this month",
            subtext: "Events for the last 6 months",
            icon: Activity,
        },
        {
            label: "Actions Taken",
            value: "3,247",
            change: "+8.2%",
            trend: "up" as const,
            description: "Trending up this month",
            subtext: "Actions for the last 6 months",
            icon: Zap,
        },
        {
            label: "Number of Channels",
            value: "24",
            change: "+2",
            trend: "up" as const,
            description: "Active channels",
            subtext: "Channels connected",
            icon: Hash,
        },
    ];

    // Mock data for recently edited automations
    const recentAutomations: (Automation & { lastEdited: string; lastEventProcessedAt: string })[] = [
        {
            id: "1",
            name: "Slack to Linear Issue Creator",
            isActive: true,
            inputs: [
                { id: "1", integration: "slack" },
                { id: "2", integration: "linear" },
            ],
            output: { integration: "linear" },
            lastEdited: "2 hours ago",
            lastEventProcessedAt: "15 minutes ago",
        },
        {
            id: "2",
            name: "Gmail to Notion Page",
            isActive: true,
            inputs: [
                { id: "3", integration: "gmail" },
            ],
            output: { integration: "notion" },
            lastEdited: "5 hours ago",
            lastEventProcessedAt: "1 hour ago",
        },
        {
            id: "3",
            name: "GitHub PR to Slack Notifier",
            isActive: false,
            inputs: [
                { id: "4", integration: "github" },
            ],
            output: { integration: "slack" },
            lastEdited: "1 day ago",
            lastEventProcessedAt: "3 days ago",
        },
        {
            id: "4",
            name: "Confluence to Linear Task",
            isActive: true,
            inputs: [
                { id: "5", integration: "confluence" },
            ],
            output: { integration: "linear" },
            lastEdited: "2 days ago",
            lastEventProcessedAt: "30 minutes ago",
        },
    ];

    return (
        <div className="mx-auto p-8 space-y-8"> 
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metrics.map((metric) => (
                    <MetricCard key={metric.label} {...metric} />
                ))}
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-4">Recently Edited Automations</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentAutomations.slice(0, 3).map((automation) => (
                        <AutomationCard key={automation.id} automation={automation} />
                    ))}
                </div>
            </div>
        </div>
    );
}

interface MetricCardProps {
    label: string;
    value: string;
    change: string;
    trend: "up" | "down";
    description: string;
    subtext: string;
    icon: React.ComponentType<{ className?: string }>;
}

function MetricCard({ label, value, change, trend, description, subtext, icon: Icon }: MetricCardProps) {
    const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;
    const trendColor = trend === "up" ? "text-green-500" : "text-red-500";

    return (
        <Card className="relative">
            <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p className="text-sm text-muted-foreground mb-2">{label}</p>
                        <div className="flex items-baseline gap-2">
                            <h2 className="text-3xl font-bold">{value}</h2>
                            <Badge 
                                variant="outline" 
                                className={`${trendColor} border-muted bg-muted/50`}
                            >
                                <TrendIcon className="h-3 w-3" />
                                <span>{change}</span>
                            </Badge>
                        </div>
                    </div>
                    <div className="p-2 rounded-lg bg-muted/50">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium mb-1">{description}</p>
                        <p className="text-xs text-muted-foreground">{subtext}</p>
                    </div>
                    <TrendIcon className={`h-5 w-5 ${trendColor}`} />
                </div>
            </CardContent>
        </Card>
    );
}

interface AutomationCardProps {
    automation: Automation & { lastEdited: string; lastEventProcessedAt: string };
}

function AutomationCard({ automation }: AutomationCardProps) {
    return (
        <Card className="hover:shadow-md transition-shadow relative">
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

export default Home;