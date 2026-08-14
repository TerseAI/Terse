import { useState } from "react"

import { IntegrationType } from "terse-types/Integrations"
import { apolloIntegrationsKey } from "terse-types/InvalidationKeys"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordVisibilityButton } from "@/components/ui/password-visibility-button"
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
            <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Connect Apollo</DialogTitle>
                    <DialogDescription>
                        Create a key in Apollo under Settings &gt; Integrations &gt; API Keys.{" "}
                        <a className="underline" href="https://developer.apollo.io/keys/#/keys" target="_blank" rel="noreferrer">
                            Open Apollo API Keys
                        </a>
                        .
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <section className="space-y-3 text-sm" aria-labelledby="apollo-permissions-heading">
                        <div>
                            <h3 id="apollo-permissions-heading" className="font-medium">
                                Permissions
                            </h3>
                            <p className="text-muted-foreground">Add the endpoints you want to use. Finding Prospects requires a master key.</p>
                        </div>
                        <dl className="divide-y divide-border">
                            <div className="space-y-1 py-2 first:pt-0">
                                <dt className="font-medium">Enrich People</dt>
                                <dd className="flex flex-col gap-1 text-muted-foreground">
                                    <code className="break-all text-foreground">api/v1/people/match</code>
                                    <code className="break-all text-foreground">api/v1/people/bulk_match</code>
                                </dd>
                            </div>
                            <div className="space-y-1 py-2">
                                <dt className="font-medium">Enrich Organization</dt>
                                <dd className="flex flex-col gap-1 text-muted-foreground">
                                    <code className="break-all text-foreground">api/v1/organizations/enrich</code>
                                    <code className="break-all text-foreground">api/v1/organizations/{"{organization_id}"}/job_postings</code>
                                </dd>
                            </div>
                            <div className="space-y-1 pt-2">
                                <dt className="font-medium">Finding Prospects</dt>
                                <dd>
                                    <code className="break-all text-foreground">api/v1/mixed_people/api_search</code>
                                </dd>
                            </div>
                        </dl>
                    </section>
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
                            <PasswordVisibilityButton visible={showKey} onToggle={() => setShowKey(value => !value)} label="Apollo API key" />
                        </div>
                    </div>
                    {error && <p className="text-sm text-danger">{error}</p>}
                    <Button type="submit" disabled={submitting || !apiKey}>
                        {submitting ? "Connecting…" : "Connect"}
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
