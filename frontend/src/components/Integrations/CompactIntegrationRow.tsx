import { IntegrationType } from "@/shared/Integrations";
import { IconForIntegration } from "@/pages/Agents/components/Integration";
import { INTEGRATION_METADATA } from "@/shared/Integrations";
import { BadgeCheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

interface CompactIntegrationRowProps {
    integration: IntegrationType;
    isConnected?: boolean;
    summary?: string;
    connect?: () => void;
    isConnecting?: boolean;
    className?: string;
}

export function CompactIntegrationRow({
    integration,
    isConnected = false,
    summary,
    connect,
    isConnecting = false,
    className
}: CompactIntegrationRowProps) {
    return (
        <div
            className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg",
                "border border-border bg-card/50",
                className
            )}
        >
            <div className="w-5 h-5 flex-shrink-0">
                <IconForIntegration integration={integration} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                        {INTEGRATION_METADATA[integration].name}
                    </span>
                    {isConnected && (
                        <BadgeCheckIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    )}
                </div>
                {isConnected && summary && (
                    <p className="text-xs text-muted-foreground truncate">
                        {summary}
                    </p>
                )}
            </div>

            {connect && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={connect}
                    disabled={isConnecting}
                    className="flex-shrink-0"
                >
                    {isConnecting ? "Connecting..." : isConnected ? "Manage" : "Connect"}
                </Button>
            )}
        </div>
    );
}

export default CompactIntegrationRow;
