import { useState } from "react"

import { IntegrationType } from "terse-types/Integrations"
import { resendIntegrationsKey } from "terse-types/InvalidationKeys"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PasswordVisibilityButton } from "@/components/ui/password-visibility-button"
import { BackendProvider } from "@/lib/http"
import { cn } from "@/lib/utils"
import { useResendIntegrations } from "@/modules/integrations/api/useResendIntegrations"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { ResendIcon } from "./IntegrationIcons"
import { DisconnectButton } from "./helpers/DisconnectButton"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

export default function ResendIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, mutate } = useResendIntegrations()
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
            await BackendProvider.createOrUpdateResendIntegration(apiKey, stateToken)
            setOpen(false)
            setApiKey("")
            await mutate()
        } catch (cause: unknown) {
            const apiError = (cause as { response?: { data?: { error?: unknown } } }).response?.data?.error
            setError(typeof apiError === "string" ? apiError : cause instanceof Error ? cause.message : "Failed to connect Resend")
        } finally {
            setSubmitting(false)
        }
    }

    const dialog = (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect Resend</DialogTitle>
                    <DialogDescription>
                        Use an API key that can list templates and send email.{" "}
                        <a className="underline" href="https://resend.com/api-keys" target="_blank" rel="noreferrer">
                            Create one in Resend
                        </a>
                        .
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={submit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="resend-api-key">API Key</Label>
                        <div className="relative">
                            <Input
                                id="resend-api-key"
                                type={showKey ? "text" : "password"}
                                value={apiKey}
                                onChange={event => setApiKey(event.target.value)}
                                placeholder="re_…"
                                autoComplete="off"
                                spellCheck={false}
                                required
                                disabled={submitting}
                                className="pr-10"
                            />
                            <PasswordVisibilityButton visible={showKey} onToggle={() => setShowKey(value => !value)} label="Resend API key" />
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
                    integration={IntegrationType.RESEND}
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
                <IntegrationCardHeader integration={IntegrationType.RESEND} isActive={isActive} />
                <CardContent>
                    {connected ? (
                        <IntegrationItem
                            icon={
                                <div className="w-4 h-4">
                                    <ResendIcon />
                                </div>
                            }
                            title="Resend"
                            description="Published transactional templates"
                        />
                    ) : (
                        <p className="py-8 text-center text-sm text-muted-foreground">No Resend integration connected</p>
                    )}
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                    <Button variant="outline" onClick={() => setOpen(true)}>
                        {connected ? "Update" : "Connect"}
                    </Button>
                    {connected && <DisconnectButton integrationType={IntegrationType.RESEND} revalidateKeys={[resendIntegrationsKey()]} />}
                </CardFooter>
            </Card>
            {dialog}
        </>
    )
}
