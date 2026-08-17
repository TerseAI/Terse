import { BadgeCheckIcon } from "lucide-react"
import { INTEGRATION_METADATA, IntegrationType } from "terse-types/Integrations"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { IconForIntegration } from "@/modules/agents/components/Integration"

import { DisconnectButton, revalidateKeysForIntegration } from "./helpers/DisconnectButton"

interface CompactIntegrationRowProps {
    integration: IntegrationType
    isConnected?: boolean
    summary?: string
    connect?: () => void
    isConnecting?: boolean
    className?: string
}

function CompactIntegrationRow({ integration, isConnected = false, summary, connect, isConnecting = false, className }: CompactIntegrationRowProps) {
    const metadata = INTEGRATION_METADATA[integration]
    const subtitle = isConnected ? summary : metadata.description

    return (
        <div className={cn("flex w-full items-center gap-3 rounded-lg border border-border bg-card/50 px-3 py-3.5", className)}>
            <div className="size-5 shrink-0">
                <IconForIntegration integration={integration} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{metadata.name}</span>
                    {isConnected && <BadgeCheckIcon className="size-3.5 shrink-0 text-success" />}
                </div>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>

            <div className="flex shrink-0 items-center gap-1">
                {isConnected && <DisconnectButton integrationType={integration} revalidateKeys={revalidateKeysForIntegration(integration)} size="sm" />}
                {connect && (
                    <Button variant="outline" size="sm" onClick={connect} disabled={isConnecting}>
                        {isConnecting ? "Connecting…" : isConnected ? "Manage" : "Connect"}
                    </Button>
                )}
            </div>
        </div>
    )
}

export default CompactIntegrationRow
