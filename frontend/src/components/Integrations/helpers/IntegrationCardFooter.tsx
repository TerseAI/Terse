import { cn } from "@/lib/utils"

import { Button } from "../../ui/button"
import { CardFooter } from "../../ui/card"

interface IntegrationCardFooterProps {
    connect?: () => void
    isConnecting?: boolean
    buttonText?: string
    compact?: boolean
}

export function IntegrationCardFooter({ connect, isConnecting = false, buttonText = "Manage Connection", compact = false }: IntegrationCardFooterProps) {
    return (
        <CardFooter className={cn(compact && "py-3 px-4")}>
            <Button variant="outline" size={compact ? "sm" : "default"} disabled={isConnecting || !connect} onClick={connect || undefined}>
                {compact ? "Connect" : buttonText}
            </Button>
        </CardFooter>
    )
}
