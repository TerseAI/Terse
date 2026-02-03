import { TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "../../../components/ui/badge"
import { Card, CardContent } from "../../../components/ui/card"
import { cn } from "../../../lib/utils"

export interface MetricCardProps {
    label: string
    value: string
    change: string
    trend: "up" | "down"
    description: string
    subtext: string
    icon: React.ComponentType<{ className?: string }>
}

export function MetricCard({ label, value, change, trend, description, subtext }: MetricCardProps) {
    const TrendIcon = trend === "up" ? TrendingUp : TrendingDown
    const trendColor = trend === "up" ? "text-chart-2" : "text-destructive"
    const trendBgColor = trend === "up" ? "bg-chart-2/10" : "bg-destructive/10"

    return (
        <Card className="overflow-hidden">
            <CardContent>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-muted-foreground mb-1 truncate">{label}</p>
                        <h2 className="text-4xl font-bold tracking-tight mb-2">{value}</h2>
                    </div>
                </div>
                <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                    <div className="">
                        <p className="text-sm font-medium mb-0.5">{description}</p>
                        <p className="text-xs text-muted-foreground">{subtext}</p>
                    </div>
                    <Badge variant="outline" className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium", trendColor, trendBgColor, "border-transparent")}>
                        <TrendIcon className="h-3 w-3" />
                        <span>{change}</span>
                    </Badge>
                </div>
            </CardContent>
        </Card>
    )
}
