import { Button } from "@/components/ui/button"
import { CardFooter } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface IntegrationCardFooterProps {
    connect?: () => void
    isConnecting?: boolean
    buttonText?: string
    compact?: boolean
    onDisconnect?: () => void
    isDisconnecting?: boolean
    showDisconnect?: boolean
}

export function IntegrationCardFooter({ connect, isConnecting = false, buttonText = "Manage Connection", compact = false, onDisconnect, isDisconnecting = false, showDisconnect = false }: IntegrationCardFooterProps) {
    return (
        <CardFooter className={cn("flex items-center justify-between gap-2", compact && "py-3 px-4")}>
            <Button variant="outline" size={compact ? "sm" : "default"} disabled={isConnecting || !connect} onClick={connect || undefined}>
                {compact ? "Connect" : buttonText}
            </Button>
            {showDisconnect && onDisconnect && (
                <Button variant="ghost" size={compact ? "sm" : "default"} disabled={isDisconnecting} onClick={onDisconnect} className="text-danger/80 hover:text-danger hover:bg-danger/10">
                    {isDisconnecting ? "Disconnecting…" : "Disconnect"}
                </Button>
            )}
        </CardFooter>
    )
}
