import { useState } from "react"

import { Eye, EyeOff } from "lucide-react"
import { IntegrationType } from "terse-types/Integrations"
import { apolloIntegrationsKey } from "terse-types/InvalidationKeys"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BackendProvider } from "@/lib/http"
import { cn } from "@/lib/utils"
import { useApolloIntegrations } from "@/modules/integrations/api/useApolloIntegrations"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { ApolloIcon } from "./IntegrationIcons"
import { DisconnectButton } from "./helpers/DisconnectButton"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

export default function ApolloIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, mutate } = useApolloIntegrations()
    const [open, setOpen] = useState(false)
    const [apiKey, setApiKey] = useState("")
    const [showKey, setShowKey] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const connected = integrations.length > 0

    const submit = async (event: React.FormEvent) => {
        event.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
            await BackendProvider.createOrUpdateApolloIntegration(apiKey, stateToken)
            setOpen(false)
            setApiKey("")
            await mutate()
        } catch (cause: unknown) {
            const apiError = (cause as { response?: { data?: { error?: unknown } } }).response?.data?.error
            setError(typeof apiError === "string" ? apiError : cause instanceof Error ? cause.message : "Failed to connect Apollo")
        } finally {
            setSubmitting(false)
        }
    }

    const dialog = (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect Apollo</DialogTitle>
                    <DialogDescription>
                        Use an Apollo.io API key. People search requires a master API key; enrichment works with a scoped key.{" "}
                        <a className="underline" href="https://developer.apollo.io/keys/" target="_blank" rel="noreferrer">
                            Create one in Apollo
                        </a>
                        .
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="apollo-api-key">API Key</Label>
                        <div className="relative">
                            <Input
                                id="apollo-api-key"
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={event => setApiKey(event.target.value)}
                                placeholder="Enter your Apollo.io API key"
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
                    <Button type="submit" disabled={submitting || !apiKey}>
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
                    integration={IntegrationType.APOLLO}
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
                <IntegrationCardHeader integration={IntegrationType.APOLLO} isActive={isActive} />
                <CardContent>
                    {connected ? (
                        <IntegrationItem
                            icon={
                                <div className="w-4 h-4">
                                    <ApolloIcon />
                                </div>
                            }
                            title="Apollo"
                            description="People and company enrichment"
                        />
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">No Apollo integration connected</p>
                    )}
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                    <Button variant="outline" onClick={() => setOpen(true)}>
                        {connected ? "Update" : "Connect"}
                    </Button>
                    {connected && <DisconnectButton integrationType={IntegrationType.APOLLO} revalidateKeys={[apolloIntegrationsKey()]} />}
                </CardFooter>
            </Card>
            {dialog}
        </>
    )
}
