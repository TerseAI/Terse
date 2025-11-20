import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { BarChart3 } from "lucide-react";
import { MetricCard, MetricCardProps } from "./MetricCard";

interface StatsMetricsSectionProps {
    isLoading: boolean;
    metrics: MetricCardProps[];
}

export function StatsMetricsSection({ isLoading, metrics }: StatsMetricsSectionProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
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
    );
}

