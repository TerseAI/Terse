import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface MetricCardProps {
    label: string;
    value: string;
    change: string;
    trend: "up" | "down";
    description: string;
    subtext: string;
    icon: React.ComponentType<{ className?: string }>;
}

export function MetricCard({ label, value, change, trend, description, subtext, icon: Icon }: MetricCardProps) {
    const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;
    const trendColor = trend === "up" ? "text-chart-2" : "text-destructive";

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

