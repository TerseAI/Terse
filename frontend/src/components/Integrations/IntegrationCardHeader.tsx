import { IntegrationTitle } from "@/pages/Automations/components/IntegrationTitle";
import { CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { BadgeCheckIcon } from "lucide-react";
import { Integration } from "@/context/Integrations";

interface IntegrationCardHeaderProps {
    integration: Integration;
}

export function IntegrationCardHeader({ integration }: IntegrationCardHeaderProps) {
    return (
        <CardHeader>
            <CardTitle>
                <div className="flex justify-between">
                    <IntegrationTitle integration={integration} iconSize="lg" />
                    <Badge variant="secondary" className="text-primary-foreground">
                        <BadgeCheckIcon className="size-3 text-primary" />
                        Connected
                    </Badge>
                </div>
            </CardTitle>
        </CardHeader>
    );
}

