import { Card, CardContent } from "../ui/card";
import { FigmaIntegration, IntegrationType } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { IntegrationItem } from "./helpers/IntegrationItem";
import { useOAuthConnection } from "@/hooks/useOAuthConnection";
import { cn } from "@/lib/utils";
import { useFigmaIntegrations } from "@/hooks/api/useFigmaIntegrations";
import { Skeleton } from "../ui/skeleton";
import { Palette } from "lucide-react";

function FigmaIntegrationCard({ className, isActive = true }: { className?: string; isActive?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.FIGMA>(IntegrationType.FIGMA, {});
    const { integrations, isLoading } = useFigmaIntegrations(); 

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.FIGMA} isActive={isActive} />
            <CardContent>
                <FigmaCardContent integrations={integrations} isLoading={isLoading} />
            </CardContent>
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} />
        </Card>
    )
}

function FigmaCardContent({ integrations, isLoading }: { integrations: Array<FigmaIntegration>, isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Palette className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Figma integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Figma account to get started</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {integrations.map((integration) => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Palette className="w-4 h-4" />}
                    title={integration.handle || integration.figma_user_id}
                    description="Figma account"
                />
            ))}
        </div>
    );
}

export default FigmaIntegrationCard;

