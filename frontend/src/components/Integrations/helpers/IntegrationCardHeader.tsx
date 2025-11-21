import { IntegrationTitle } from "@/pages/Channels/components/IntegrationTitle";
import { CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { BadgeCheckIcon } from "lucide-react";
import { IntegrationType } from "@/shared/Integrations"

interface IntegrationCardHeaderProps {
    integration: IntegrationType;
    isActive?: boolean;
}

export function IntegrationCardHeader({ integration, isActive = true }: IntegrationCardHeaderProps) {
    return (
        <CardHeader>
            <CardTitle>
                <div className="flex justify-between">
                    <IntegrationTitle integration={integration} iconSize="lg" />
                    {isActive && (
                        <Badge variant="secondary" className="text-foreground">
                            <BadgeCheckIcon className="size-3 text-primary" />
                            Connected
                        </Badge>
                    )}
                </div>
            </CardTitle>
        </CardHeader>
    );
}

