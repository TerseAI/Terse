import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { TrendingUp, TrendingDown, Activity, Zap, Hash, Clock, BarChart3, PlayCircle, Settings } from "lucide-react";
import { AppsList } from "../components/Automation/AppsList";
import { Automation } from "../shared/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { IconForInputType } from "../pages/Automations/components/Integration";
import { Integration } from "@/types/Integration";
import { ScrollArea } from "../components/ui/scroll-area";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";

function Home() {
    // Flag to easily test empty states - set to false to see empty states
    const USE_MOCK_DATA = true;

    // Mock data
    const metrics = USE_MOCK_DATA ? [
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
    ] : [];

    // Mock data for recently edited automations
    const recentAutomations: (Automation & { lastEdited: string; lastEventProcessedAt: string })[] = USE_MOCK_DATA ? [
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
    ] : [];

    // Mock data for events processed per day (last 7 days)
    const eventsPerDay = USE_MOCK_DATA ? [
        { date: "Mon", events: 1240 },
        { date: "Tue", events: 1890 },
        { date: "Wed", events: 2100 },
        { date: "Thu", events: 1750 },
        { date: "Fri", events: 2300 },
        { date: "Sat", events: 980 },
        { date: "Sun", events: 1190 },
    ] : [];

    const chartConfig = {
        events: {
            label: "Events",
            color: "var(--chart-1)",
        },
    };

    // Mock data for recently run actions
    const recentActions: (RunHistoryAction & { timestamp: string; automationName: string })[] = USE_MOCK_DATA ? [
        {
            action: "Created Linear issue",
            integration: "linear",
            target: "Engineering Team",
            details: "Issue created from Slack message",
            timestamp: "5 minutes ago",
            automationName: "Slack to Linear Issue Creator",
        },
        {
            action: "Created Notion page",
            integration: "notion",
            target: "Project Database",
            details: "Page created from Gmail email",
            timestamp: "12 minutes ago",
            automationName: "Gmail to Notion Page",
        },
        {
            action: "Sent Slack notification",
            integration: "slack",
            target: "#engineering",
            details: "Notified team about GitHub PR",
            timestamp: "18 minutes ago",
            automationName: "GitHub PR to Slack Notifier",
        },
        {
            action: "Created Linear task",
            integration: "linear",
            target: "Product Team",
            details: "Task created from Confluence page",
            timestamp: "25 minutes ago",
            automationName: "Confluence to Linear Task",
        },
        {
            action: "Updated Jira ticket",
            integration: "jira",
            target: "PROJ-123",
            details: "Ticket updated from Slack message",
            timestamp: "32 minutes ago",
            automationName: "Slack to Jira Sync",
        },
    ] : [];

    return (
        <div className="mx-auto p-8 space-y-8"> 
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metrics.map((metric) => (
                    <MetricCard key={metric.label} {...metric} />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <h2 className="text-2xl font-bold mb-4">Events Processed Per Day</h2>
                    <Card>
                        <CardHeader>
                            <CardTitle>Daily Events</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {eventsPerDay.length > 0 ? (
                                <ChartContainer config={chartConfig} className="h-[300px]">
                                    <AreaChart data={eventsPerDay}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            dataKey="date" 
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                        />
                                        <YAxis 
                                            tickLine={false}
                                            axisLine={false}
                                            tickMargin={8}
                                        />
                                        <ChartTooltip 
                                            cursor={false}
                                            content={<ChartTooltipContent indicator="dot" />}
                                        />
                                        <Area 
                                            type="monotone" 
                                            dataKey="events" 
                                            stroke="var(--color-events)" 
                                            fill="var(--color-events)" 
                                            fillOpacity={0.2}
                                        />
                                    </AreaChart>
                                </ChartContainer>
                            ) : (
                                <Empty className="h-[300px] border-0">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <BarChart3 className="text-primary" />
                                        </EmptyMedia>
                                        <EmptyTitle>No events yet</EmptyTitle>
                                        <EmptyDescription>
                                            Event processing data will appear here once your automations start running
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </CardContent>
                    </Card>
                </div>

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
                                            Actions taken by your automations will appear here once they start processing events
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <div>
                <h2 className="text-2xl font-bold mb-4">Recently Edited Automations</h2>
                {recentAutomations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentAutomations.slice(0, 3).map((automation) => (
                            <AutomationCard key={automation.id} automation={automation} />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="py-12">
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
                            </Empty>
                        </CardContent>
                    </Card>
                )}
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

interface ActionItemProps {
    action: RunHistoryAction & { timestamp: string; automationName: string };
}

function ActionItem({ action }: ActionItemProps) {
    return (
        <div className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
            <div className="mt-0.5">
                <div className="w-8 h-8 flex items-center justify-center rounded bg-muted/50">
                    <IconForInputType type={action.integration as Integration} />
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium">{action.action}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {action.timestamp}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground mb-1">
                    {action.automationName}
                </p>
                <p className="text-xs text-muted-foreground">
                    {action.target} • {action.details}
                </p>
            </div>
        </div>
    );
}

export default Home;