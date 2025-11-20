import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, Zap, Hash, Clock, BarChart3, PlayCircle, Settings, Plus } from "lucide-react";
import { AppsList } from "../components/Automation/AppsList";
import { Automation } from "../shared/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { RunHistoryAction } from "../shared/RunHistoryTypes";
import { IconForIntegration } from "../pages/Automations/components/Integration";
import { ScrollArea } from "../components/ui/scroll-area";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { IntegrationType } from "../shared/Integrations";
import { useRecentAutomations } from "../hooks/api/useRecentAutomations";
import { useStats } from "../hooks/api/useStats";
import { formatRelativeTime } from "../utility/timeUtils";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";

function Home() {
    const navigate = useNavigate();

    const { automations: recentAutomationsData, isLoading: isLoadingAutomations } = useRecentAutomations(3);
    const { stats, isLoading: isLoadingStats } = useStats();

    // Format number with commas
    const formatNumber = (num: number): string => {
        return num.toLocaleString();
    };

    // Determine trend from change string
    const getTrend = (change: string): "up" | "down" => {
        return change.startsWith("+") || (!change.startsWith("-") && change !== "0%") ? "up" : "down";
    };

    // Transform stats data to match the component's expected format
    const metrics = stats ? [
        {
            label: "Total events processed",
            value: formatNumber(stats.totalEventsProcessed),
            change: stats.totalEventsProcessedChange,
            trend: getTrend(stats.totalEventsProcessedChange),
            description: "Events processed this month",
            subtext: "Events for the last 6 months",
            icon: Activity,
        },
        {
            label: "Actions Taken",
            value: formatNumber(stats.actionsTaken),
            change: stats.actionsTakenChange,
            trend: getTrend(stats.actionsTakenChange),
            description: "Trending up this month",
            subtext: "Actions for the last 6 months",
            icon: Zap,
        },
        {
            label: "Number of Automations",
            value: formatNumber(stats.numberOfAutomations),
            change: stats.numberOfAutomationsChange,
            trend: getTrend(stats.numberOfAutomationsChange),
            description: "Total automations",
            subtext: "Automations created",
            icon: Hash,
        },
    ] : [];

    // Transform real data to match the component's expected format
    const recentAutomations = recentAutomationsData.map(automation => ({
        ...automation,
        lastEdited: formatRelativeTime(automation.updatedAt),
        lastEventProcessedAt: automation.lastEventProcessedAt
            ? formatRelativeTime(automation.lastEventProcessedAt)
            : "Never",
    }));

    // Get daily events from stats
    const eventsPerDay = stats?.dailyEvents || [];

    const chartConfig = {
        events: {
            label: "Events",
            color: "var(--chart-1)",
        },
    };

    // Get recent actions from stats
    const recentActions: (RunHistoryAction & { timestamp: string; automationName: string })[] = stats?.recentActions
        ? stats.recentActions.map((action) => ({
              action: action.action,
              integration: action.integration as IntegrationType,
              target: action.target,
              details: action.details,
              url: action.url,
              timestamp: formatRelativeTime(action.timestamp),
              automationName: action.automationName,
          }))
        : [];

    return (
        <div className="mx-auto p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoadingStats ? (
                    <>
                        {[1, 2, 3].map((i) => (
                            <Card key={i} className="relative">
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <Skeleton className="h-4 w-32 mb-2" />
                                            <div className="flex items-baseline gap-2">
                                                <Skeleton className="h-8 w-24" />
                                                <Skeleton className="h-5 w-16" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-9 w-9 rounded-lg" />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <Skeleton className="h-4 w-40 mb-1" />
                                            <Skeleton className="h-3 w-32" />
                                        </div>
                                        <Skeleton className="h-5 w-5" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </>
                ) : metrics.length > 0 ? (
                    metrics.map((metric) => (
                        <MetricCard key={metric.label} {...metric} />
                    ))
                ) : (
                    <div className="col-span-3">
                        <Empty className="border-0">
                            <EmptyHeader>
                                <EmptyMedia variant="icon">
                                    <BarChart3 className="text-primary" />
                                </EmptyMedia>
                                <EmptyTitle>No stats available</EmptyTitle>
                                <EmptyDescription>
                                    Statistics will appear here once you start using automations
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    </div>
                )}
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
                {isLoadingAutomations ? (
                    <Card>
                        <CardContent className="py-12">
                            <div className="text-center text-muted-foreground">Loading...</div>
                        </CardContent>
                    </Card>
                ) : recentAutomations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentAutomations.map((automation) => (
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

interface ActionItemProps {
    action: RunHistoryAction & { timestamp: string; automationName: string };
}

function ActionItem({ action }: ActionItemProps) {
    return (
        <div className="flex items-start gap-3 pb-4 border-b last:border-0 last:pb-0">
            <div className="mt-0.5">
                <div className="w-8 h-8 flex items-center justify-center rounded bg-muted/50">
                    <IconForIntegration integration={action.integration} />
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