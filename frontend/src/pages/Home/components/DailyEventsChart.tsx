import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { BarChart3, Clock } from "lucide-react";
import { DailyEventCount } from "../../../shared/types";

interface DailyEventsChartProps {
    eventsPerDay: DailyEventCount[];
    timezone?: string;
}

// Format timezone for display using Intl.DisplayNames if available, with fallback
function formatTimezone(tz: string): string {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
        try {
            const displayNames = new Intl.DisplayNames([navigator.language || "en"], { type: "timezone" });
            const displayName = displayNames.of(tz);
            if (displayName) return displayName;
        } catch {
            // Fallback below
        }
    }
    // Fallback: replace underscores with spaces
    return tz.replace(/_/g, ' ');
}

export function DailyEventsChart({ eventsPerDay, timezone }: DailyEventsChartProps) {
    const chartConfig = {
        events: {
            label: "Events",
            color: "var(--chart-1)",
        },
    };

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Events Processed Per Day</h2>
            <Card>
                <CardHeader>
                    <CardTitle>Daily Events</CardTitle>
                    {timezone && (
                        <CardDescription className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Times shown in {formatTimezone(timezone)}
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent className="-ml-6">
                    {eventsPerDay.length > 0 ? (
                        <ChartContainer config={chartConfig} className="h-[300px] w-full [&>div]:!w-full">
                            <AreaChart 
                                data={eventsPerDay}
                                margin={{ left: 24, right: 24, top: 0, bottom: 0 }}
                            >
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
    );
}

