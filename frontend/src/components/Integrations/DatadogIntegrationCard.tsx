import { useState } from "react"

import { BarChart3, Eye, EyeOff } from "lucide-react"

import { useDatadogIntegrations } from "@/hooks/api/useDatadogIntegrations"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { DatadogIntegration, INTEGRATION_METADATA, IntegrationType } from "@/shared/Integrations"

import { Button } from "../ui/button"
import { Card, CardContent, CardFooter } from "../ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

const DATADOG_REGIONS = [
    { value: "us", label: "US (datadoghq.com)" },
    { value: "eu", label: "EU (datadoghq.eu)" },
    { value: "us3", label: "US3 (us3.datadoghq.com)" },
    { value: "us5", label: "US5 (us5.datadoghq.com)" },
    { value: "ap1", label: "AP1 (ap1.datadoghq.com)" }
]

function DatadogIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, isLoading, mutate } = useDatadogIntegrations()
    const [showForm, setShowForm] = useState(false)
    const [apiKey, setApiKey] = useState("")
    const [appKey, setAppKey] = useState("")
    const [showApiKey, setShowApiKey] = useState(false)
    const [showAppKey, setShowAppKey] = useState(false)
    const [region, setRegion] = useState("us")
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
            await BackendProvider.createOrUpdateDatadogIntegration(apiKey, appKey, region, stateToken)
            setShowForm(false)
            setApiKey("")
            setAppKey("")
            setRegion("us")
            mutate() // Refresh integrations list
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect Datadog integration")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        setShowForm(false)
        setApiKey("")
        setAppKey("")
        setRegion("us")
        setError(null)
    }

    const isConnected = integrations.length > 0
    const summary = integrations[0] ? `Region: ${integrations[0].region.toUpperCase()}` : undefined

    const formDialog = (
        <Dialog open={showForm} onOpenChange={open => !open && handleCancel()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Connect {INTEGRATION_METADATA[IntegrationType.DATADOG].name}</DialogTitle>
                    <DialogDescription>Enter your Datadog API credentials to connect your account.</DialogDescription>
                </DialogHeader>
                <DatadogForm
                    apiKey={apiKey}
                    setApiKey={setApiKey}
                    appKey={appKey}
                    setAppKey={setAppKey}
                    showApiKey={showApiKey}
                    setShowApiKey={setShowApiKey}
                    showAppKey={showAppKey}
                    setShowAppKey={setShowAppKey}
                    region={region}
                    setRegion={setRegion}
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
                <CompactIntegrationRow integration={IntegrationType.DATADOG} isConnected={isConnected} summary={summary} connect={handleConnect} isConnecting={isSubmitting} className={className} />
                {formDialog}
            </>
        )
    }

    return (
        <>
            <Card className={cn(className)}>
                <IntegrationCardHeader integration={IntegrationType.DATADOG} isActive={isActive} />
                <CardContent>
                    <DatadogCardContent integrations={integrations} isLoading={isLoading} />
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

function DatadogCardContent({ integrations, isLoading }: { integrations: Array<DatadogIntegration>; isLoading: boolean }) {
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
                <BarChart3 className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Datadog integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Datadog account to get started</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => {
                const regionLabel = DATADOG_REGIONS.find(r => r.value === integration.region)?.label || integration.region
                return <IntegrationItem key={integration.id} icon={<BarChart3 className="w-4 h-4" />} title={`Datadog (${regionLabel})`} description={`Region: ${integration.region.toUpperCase()}`} />
            })}
        </div>
    )
}

function DatadogForm({
    apiKey,
    setApiKey,
    appKey,
    setAppKey,
    showApiKey,
    setShowApiKey,
    showAppKey,
    setShowAppKey,
    region,
    setRegion,
    onSubmit,
    onCancel,
    isSubmitting,
    error
}: {
    apiKey: string
    setApiKey: (value: string) => void
    appKey: string
    setAppKey: (value: string) => void
    showApiKey: boolean
    setShowApiKey: (value: boolean) => void
    showAppKey: boolean
    setShowAppKey: (value: boolean) => void
    region: string
    setRegion: (value: string) => void
    onSubmit: (e: React.FormEvent) => void
    onCancel: () => void
    isSubmitting: boolean
    error: string | null
}) {
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="region">Region</Label>
                <Select value={region} onValueChange={setRegion} disabled={isSubmitting}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                    <SelectContent>
                        {DATADOG_REGIONS.map(r => (
                            <SelectItem key={r.value} value={r.value}>
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2">
                <Label htmlFor="apiKey">API Key</Label>
                <div className="relative">
                    <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        placeholder="Enter your Datadog API key"
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

            <div className="space-y-2">
                <Label htmlFor="appKey">Application Key</Label>
                <div className="relative">
                    <Input
                        id="appKey"
                        type={showAppKey ? "text" : "password"}
                        value={appKey}
                        onChange={e => setAppKey(e.target.value)}
                        placeholder="Enter your Datadog Application key"
                        disabled={isSubmitting}
                        required
                        className="pr-10"
                        autoComplete="off"
                    />
                    <button
                        type="button"
                        onClick={() => setShowAppKey(!showAppKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isSubmitting}
                    >
                        {showAppKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
                <Button type="submit" disabled={isSubmitting || !apiKey || !appKey || !region}>
                    {isSubmitting ? "Connecting..." : "Connect"}
                </Button>
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
            </div>
        </form>
    )
}

export default DatadogIntegrationCard
