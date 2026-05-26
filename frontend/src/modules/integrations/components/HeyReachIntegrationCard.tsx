import { useState } from "react"

import { Eye, EyeOff } from "lucide-react"
import { HeyReachIntegration, INTEGRATION_METADATA, IntegrationType } from "terse-types/Integrations"
import { heyReachIntegrationsKey } from "terse-types/InvalidationKeys"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { BackendProvider } from "@/lib/http"
import { cn } from "@/lib/utils"
import { useHeyReachIntegrations } from "@/modules/integrations/api/useHeyReachIntegrations"

import CompactIntegrationRow from "./CompactIntegrationRow"
import { HeyReachIcon } from "./IntegrationIcons"
import { DisconnectButton } from "./helpers/DisconnectButton"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function HeyReachIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, isLoading, mutate } = useHeyReachIntegrations()
    const [showForm, setShowForm] = useState(false)
    const [apiKey, setApiKey] = useState("")
    const [showApiKey, setShowApiKey] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConnect = () => {
        setShowForm(true)
        setError(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await BackendProvider.createOrUpdateHeyReachIntegration(apiKey, stateToken)
            setShowForm(false)
            setApiKey("")
            mutate()
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect HeyReach integration")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        setShowForm(false)
        setApiKey("")
        setError(null)
    }

    const isConnected = integrations.length > 0
    const summary = isConnected ? "API key connected" : undefined

    const formDialog = (
        <Dialog open={showForm} onOpenChange={open => !open && handleCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect {INTEGRATION_METADATA[IntegrationType.HEY_REACH].name}</DialogTitle>
                    <DialogDescription>
                        Enter your HeyReach API key.{" "}
                        <a href="https://app.heyreach.io/app/integrations/public-api/api" target="_blank" rel="noopener noreferrer" className="underline">
                            Generate one in HeyReach
                        </a>
                        .
                    </DialogDescription>
                </DialogHeader>
                <HeyReachForm
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    showApiKey={showApiKey}
                    setShowApiKey={setShowApiKey}
                    onSubmit={handleSubmit}
                    onCancel={handleCancel}
                    isSubmitting={isSubmitting}
                    error={error}
                />
            </DialogContent>
        </Dialog>
    )

    if (compact) {
        return (
            <>
                <CompactIntegrationRow integration={IntegrationType.HEY_REACH} isConnected={isConnected} summary={summary} connect={handleConnect} isConnecting={isSubmitting} className={className} />
                {formDialog}
            </>
        )
    }

    return (
        <>
            <Card className={cn(className)}>
                <IntegrationCardHeader integration={IntegrationType.HEY_REACH} isActive={isActive} />
                <CardContent>
                    <HeyReachCardContent integrations={integrations} isLoading={isLoading} />
                </CardContent>
                <CardFooter className="flex items-center justify-between gap-2">
                    <Button variant="outline" onClick={handleConnect}>
                        {integrations.length > 0 ? "Update" : "Connect"}
                    </Button>
                    {isConnected ? <DisconnectButton integrationType={IntegrationType.HEY_REACH} revalidateKeys={[heyReachIntegrationsKey()]} /> : null}
                </CardFooter>
            </Card>
            {formDialog}
        </>
    )
}

function HeyReachCardContent({ integrations, isLoading }: { integrations: Array<HeyReachIntegration>; isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
            </div>
        )
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="w-10 h-10 mb-3">
                    <HeyReachIcon />
                </div>
                <p className="text-sm text-muted-foreground">No HeyReach integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your HeyReach account</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={
                        <div className="w-4 h-4">
                            <HeyReachIcon />
                        </div>
                    }
                    title="HeyReach"
                    description="LinkedIn outreach events"
                />
            ))}
        </div>
    )
}

function HeyReachForm({
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    onSubmit,
    onCancel,
    isSubmitting,
    error
}: {
    apiKey: string
    setApiKey: (value: string) => void
    showApiKey: boolean
    setShowApiKey: (value: boolean) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
    isSubmitting: boolean
    error: string | null
}) {
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="relative">
                    <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Enter your HeyReach API key"
                        disabled={isSubmitting}
                        required
                        className="pr-10"
                        autoComplete="off"
                    />
                    <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isSubmitting}
                    >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting || !apiKey}>
                    {isSubmitting ? "Connecting..." : "Connect"}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}

export default HeyReachIntegrationCard
