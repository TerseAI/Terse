import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { BarChart3 } from "lucide-react";
import { DailyEventCount } from "../../../shared/types";

interface DailyEventsChartProps {
    eventsPerDay: DailyEventCount[];
}

export function DailyEventsChart({ eventsPerDay }: DailyEventsChartProps) {
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
    );
}

