import { useState } from "react"

import { Eye, EyeOff } from "lucide-react"
import { IntegrationType } from "terse-types/Integrations"
import { higgsfieldIntegrationsKey } from "terse-types/InvalidationKeys"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BackendProvider } from "@/lib/http"
import { cn } from "@/lib/utils"
import { useHiggsfieldIntegrations } from "@/modules/integrations/api/useHiggsfieldIntegrations"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { HiggsfieldIcon } from "./IntegrationIcons"
import { DisconnectButton } from "./helpers/DisconnectButton"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

export default function HiggsfieldIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, mutate } = useHiggsfieldIntegrations()
    const [open, setOpen] = useState(false)
    const [credentials, setCredentials] = useState("")
    const [showKey, setShowKey] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const connected = integrations.length > 0

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
            await BackendProvider.createOrUpdateHiggsfieldIntegration(credentials, stateToken)
            setOpen(false)
            setCredentials("")
            await mutate()
        } catch (cause: unknown) {
            const apiError = (cause as { response?: { data?: { error?: unknown } } }).response?.data?.error
            setError(typeof apiError === "string" ? apiError : cause instanceof Error ? cause.message : "Failed to connect Higgsfield")
        } finally {
            setSubmitting(false)
        }
    }

    const dialog = (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect Higgsfield</DialogTitle>
                    <DialogDescription>
                        Generate a key in the API keys section of the{" "}
                        <a className="underline" href="https://cloud.higgsfield.ai" target="_blank" rel="noreferrer">
                            Higgsfield dashboard
                        </a>
                        . It gives you a Key ID and a Key Secret. Paste them below as one string joined by a colon, with no spaces. Generation spends Higgsfield credits.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="higgsfield-credentials">Key ID and Key Secret</Label>
                        <div className="relative">
                            <Input
                                id="higgsfield-credentials"
                                type={showKey ? "text" : "password"}
                                value={credentials}
                                onChange={event => setCredentials(event.target.value)}
                                placeholder="KEY_ID:KEY_SECRET"
                                required
                                disabled={submitting}
                                className="pr-10"
                            />
                            <button type="button" onClick={() => setShowKey(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <Button type="submit" disabled={submitting || !credentials}>
                        {submitting ? "Connecting..." : "Connect"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )

    if (compact)
        return (
            <>
                <CompactIntegrationRow
                    integration={IntegrationType.HIGGSFIELD}
                    isConnected={connected}
                    summary={connected ? "API key connected" : undefined}
                    connect={() => setOpen(true)}
                    isConnecting={submitting}
                    className={className}
                />
                {dialog}
            </>
        )

    return (
        <>
            <Card className={cn(className)}>
                <IntegrationCardHeader integration={IntegrationType.HIGGSFIELD} isActive={isActive} />
                <CardContent>
                    {connected ? (
                        <IntegrationItem
                            icon={
                                <div className="w-4 h-4">
                                    <HiggsfieldIcon />
                                </div>
                            }
                            title="Higgsfield"
                            description="Image generation for ad creative"
                        />
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">No Higgsfield integration connected</p>
                    )}
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                    <Button variant="outline" onClick={() => setOpen(true)}>
                        {connected ? "Update" : "Connect"}
                    </Button>
                    {connected && <DisconnectButton integrationType={IntegrationType.HIGGSFIELD} revalidateKeys={[higgsfieldIntegrationsKey()]} />}
                </CardFooter>
            </Card>
            {dialog}
        </>
    )
}
