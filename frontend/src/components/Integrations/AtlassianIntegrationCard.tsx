import { Card, CardContent } from "../ui/card";
import { IntegrationType } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationCardFooter } from "./helpers/IntegrationCardFooter";
import { IntegrationItem } from "./helpers/IntegrationItem";
import { useOAuthConnection } from "@/hooks/useOAuthConnection";
import { cn } from "@/lib/utils";
import { useAtlassianIntegrations } from "@/hooks/api/useAtlassianIntegrations";
import { Skeleton } from "../ui/skeleton";
import { Globe, Mail } from "lucide-react";

function AtlassianIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { connect, isConnecting } = useOAuthConnection<IntegrationType.ATLASSIAN>(IntegrationType.ATLASSIAN, {}, stateToken);
    const { integrations, isLoading } = useAtlassianIntegrations();

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.ATLASSIAN} isActive={isActive} compact={compact} />
            {!compact && (
                <CardContent>
                    <AtlassianCardContent integrations={integrations} isLoading={isLoading} />
                </CardContent>
            )}
            <IntegrationCardFooter connect={connect} isConnecting={isConnecting} compact={compact} />
        </Card>
    )
}

function AtlassianCardContent({ integrations, isLoading }: { integrations: Array<{ id: string; email: string; baseUrl: string }>, isLoading: boolean }) {
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
                <Globe className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Atlassian integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Atlassian account to get started</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {integrations.map((integration) => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Globe className="w-4 h-4" />}
                    title={integration.baseUrl}
                    description={
                        <span className="flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            <span className="truncate">{integration.email}</span>
                        </span>
                    }
                />
            ))}
        </div>
    );
}

export default AtlassianIntegrationCard;

