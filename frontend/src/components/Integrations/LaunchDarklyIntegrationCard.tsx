import { useState } from "react"

import { Eye, EyeOff, Flag } from "lucide-react"

import { useLaunchdarklyIntegrations } from "@/hooks/api/useLaunchdarklyIntegrations"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { INTEGRATION_METADATA, IntegrationType, LaunchDarklyIntegration } from "@/shared/Integrations"

import { Button } from "../ui/button"
import { Card, CardContent, CardFooter } from "../ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

function LaunchDarklyIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, isLoading, mutate } = useLaunchdarklyIntegrations()
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
            await BackendProvider.createOrUpdateLaunchDarklyIntegration(apiKey, stateToken)
            setShowForm(false)
            setApiKey("")
            mutate() // Refresh integrations list
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect LaunchDarkly integration")
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
    const summary = integrations[0]?.tokenName ?? integrations[0]?.email ?? undefined

    const formDialog = (
        <Dialog open={showForm} onOpenChange={open => !open && handleCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect {INTEGRATION_METADATA[IntegrationType.LAUNCHDARKLY].name}</DialogTitle>
                    <DialogDescription>Enter your LaunchDarkly API key to connect your account.</DialogDescription>
                </DialogHeader>
                <LaunchDarklyForm
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
                <CompactIntegrationRow
                    integration={IntegrationType.LAUNCHDARKLY}
                    isConnected={isConnected}
                    summary={summary}
                    connect={handleConnect}
                    isConnecting={isSubmitting}
                    className={className}
                />
                {formDialog}
            </>
        )
    }

    return (
        <>
            <Card className={cn(className)}>
                <IntegrationCardHeader integration={IntegrationType.LAUNCHDARKLY} isActive={isActive} />
                <CardContent>
                    <LaunchDarklyCardContent integrations={integrations} isLoading={isLoading} mutate={mutate} />
                </CardContent>
                <CardFooter>
                    <Button variant="outline" onClick={handleConnect}>
                        {integrations.length > 0 ? "Update" : "Connect"}
                    </Button>
                </CardFooter>
            </Card>
            {formDialog}
        </>
    )
}

function LaunchDarklyCardContent({ integrations, isLoading, mutate }: { integrations: Array<LaunchDarklyIntegration>; isLoading: boolean; mutate: () => void }) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        )
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Flag className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No LaunchDarkly integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your LaunchDarkly account to get started</p>
            </div>
        )
    }

    const handleDelete = async (integrationId: string) => {
        await BackendProvider.deleteIntegration(IntegrationType.LAUNCHDARKLY, integrationId)
        mutate()
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Flag className="w-4 h-4" />}
                    title={integration.tokenName || integration.email || "LaunchDarkly"}
                    description={integration.tokenName ? "LaunchDarkly token" : "LaunchDarkly account"}
                    onDelete={() => handleDelete(integration.id)}
                    deleteConfirmTitle="Remove LaunchDarkly Connection"
                    deleteConfirmDescription={`Are you sure you want to remove the LaunchDarkly connection? This action cannot be undone.`}
                />
            ))}
        </div>
    )
}

function LaunchDarklyForm({
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
                        placeholder="Enter your LaunchDarkly API key"
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
                {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
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

export default LaunchDarklyIntegrationCard
