import { IntegrationTitle } from "@/pages/Agents/components/IntegrationTitle";
import { CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { BadgeCheckIcon } from "lucide-react";
import { IntegrationType } from "@/shared/Integrations"
import { cn } from "@/lib/utils";

interface IntegrationCardHeaderProps {
    integration: IntegrationType;
    isActive?: boolean;
    compact?: boolean;
}

export function IntegrationCardHeader({ integration, isActive = true, compact = false }: IntegrationCardHeaderProps) {
    return (
        <CardHeader className={cn(compact && "py-3 px-4")}>
            <CardTitle>
                <div className={cn("flex justify-between", compact && "items-center")}>
                    <IntegrationTitle integration={integration} iconSize={compact ? "sm" : "lg"} />
                    {isActive && (
                        <Badge variant="secondary" className={cn("text-foreground", compact && "text-xs py-0.5 px-1.5")}>
                            <BadgeCheckIcon className={cn("text-primary", compact ? "size-2.5" : "size-3")} />
                            Connected
                        </Badge>
                    )}
                </div>
            </CardTitle>
        </CardHeader>
    );
}

