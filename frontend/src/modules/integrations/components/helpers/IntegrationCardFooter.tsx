import { type Key } from "swr"
import { IntegrationType } from "terse-types/Integrations"

import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"
import { cn } from "@/lib/utils"

import { DisconnectButton } from "./DisconnectButton"

interface DisconnectConfig {
    integrationType: IntegrationType
    revalidateKeys?: Key[]
}

interface IntegrationCardFooterProps {
    connect?: () => void
    isConnecting?: boolean
    buttonText?: string
    compact?: boolean
    disconnect?: DisconnectConfig
}

export function IntegrationCardFooter({ connect, isConnecting = false, buttonText = "Manage Connection", compact = false, disconnect }: IntegrationCardFooterProps) {
    return (
        <CardFooter className={cn("flex items-center justify-between gap-2", compact && "py-3 px-4")}>
            <Button variant="outline" size={compact ? "sm" : "default"} disabled={isConnecting || !connect} onClick={connect || undefined}>
                {compact ? "Connect" : buttonText}
            </Button>
            {disconnect ? (
                <DisconnectButton integrationType={disconnect.integrationType} revalidateKeys={disconnect.revalidateKeys} size={compact ? "sm" : "default"} />
            ) : null}
        </CardFooter>
    )
}
