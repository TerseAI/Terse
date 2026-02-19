import { useState } from "react"

import { AlertTriangleIcon, Eye, EyeOff, Info, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDatadogIndexes } from "@/hooks/api/useDatadogIndexes"
import { useDatadogIntegrations } from "@/hooks/api/useDatadogIntegrations"
import { BackendProvider } from "@/services/backend"
import { DatadogConfig } from "@/shared/Configs"
import type { DatadogIndex } from "@/shared/types"

import { InputConfigSelectorProps } from "./types"

const DATADOG_REGIONS = [
    { value: "us", label: "US (datadoghq.com)" },
    { value: "eu", label: "EU (datadoghq.eu)" },
    { value: "us3", label: "US3 (us3.datadoghq.com)" },
    { value: "us5", label: "US5 (us5.datadoghq.com)" },
    { value: "ap1", label: "AP1 (ap1.datadoghq.com)" }
]

export function DatadogIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    const { integrations, isLoading, mutate } = useDatadogIntegrations()
    const datadogConfig = (input.config as DatadogConfig) || new DatadogConfig("", ["main"])
    const selectedIntegrationId = datadogConfig.integrationId || null
    const { indexes, isLoading: isLoadingIndexes } = useDatadogIndexes(selectedIntegrationId)

    const [showConnectForm, setShowConnectForm] = useState(false)
    const [apiKey, setApiKey] = useState("")
    const [appKey, setAppKey] = useState("")
    const [showApiKey, setShowApiKey] = useState(false)
    const [showAppKey, setShowAppKey] = useState(false)
    const [region, setRegion] = useState("us")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleConnect = () => {
        setShowConnectForm(true)
        setError(null)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await BackendProvider.createOrUpdateDatadogIntegration(apiKey, appKey, region)
            setShowConnectForm(false)
            setApiKey("")
            setAppKey("")
            setRegion("us")
            await mutate()
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect Datadog integration")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        setShowConnectForm(false)
        setApiKey("")
        setAppKey("")
        setRegion("us")
        setError(null)
    }

    if (isLoading) {
        return <Skeleton className="h-20 w-full" />
    }

    if (variant === "card") {
        if (integrations.length === 0) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect Datadog
                </div>
            )
        }
        const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId)
        const hasIndexes = datadogConfig.defaultIndexes && datadogConfig.defaultIndexes.length > 0
        const displayText = hasIndexes ? `Indexes: ${datadogConfig.defaultIndexes.join(", ")}` : selectedIntegration ? "Configure indexes" : "Select integration"
        return <div className="text-xs text-center">{displayText}</div>
    }

    if (integrations.length === 0 && !showConnectForm) {
        return (
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">No Datadog integrations connected. Connect your Datadog account to get started.</div>
                <Button onClick={handleConnect}>
                    <Plus className="w-4 h-4" />
                    Connect Datadog
                </Button>
            </div>
        )
    }

    if (showConnectForm) {
        return (
            <div className="space-y-4 p-4 rounded-lg border border-input bg-card">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="region">Region</Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                                        <Info className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="flex flex-col gap-1">
                                        <span>Select your Datadog region</span>
                                        <span className="text-xs">This determines which Datadog site your API keys are for</span>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </div>
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
                        <div className="flex items-center gap-2">
                            <Label htmlFor="apiKey">API Key</Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                                        <Info className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="flex flex-col gap-1">
                                        <span>Get your API key from Datadog</span>
                                        <a href="https://app.datadoghq.com/organization-settings/api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                                            Open API keys page
                                        </a>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </div>
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
                        <div className="flex items-center gap-2">
                            <Label htmlFor="appKey">Application Key</Label>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                                        <Info className="h-4 w-4" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <div className="flex flex-col gap-1">
                                        <span>Get your Application key from Datadog</span>
                                        <a href="https://app.datadoghq.com/organization-settings/application-keys" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                                            Open Application keys page
                                        </a>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        </div>
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
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        )
    }

    const updateIntegrationId = (integrationId: string) => {
        setConfig(new DatadogConfig(integrationId, ["main"]))
    }

    const toggleIndex = (indexId: string) => {
        const currentIndexes = datadogConfig.defaultIndexes || []
        const isSelected = currentIndexes.includes(indexId)

        let newIndexes: string[]
        if (isSelected) {
            newIndexes = currentIndexes.filter(id => id !== indexId)
            if (newIndexes.length === 0) {
                newIndexes = ["main"]
            }
        } else {
            newIndexes = [...currentIndexes, indexId]
        }

        setConfig(new DatadogConfig(datadogConfig.integrationId, newIndexes))
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Datadog Integration</Label>
                <Select value={selectedIntegrationId || ""} onValueChange={updateIntegrationId}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an integration" />
                    </SelectTrigger>
                    <SelectContent>
                        {integrations.map(integration => {
                            const regionLabel = DATADOG_REGIONS.find(r => r.value === integration.region)?.label || integration.region.toUpperCase()
                            return (
                                <SelectItem key={integration.id} value={integration.id}>
                                    Datadog ({regionLabel})
                                </SelectItem>
                            )
                        })}
                    </SelectContent>
                </Select>
            </div>

            <Button onClick={handleConnect} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
                Connect Another Datadog
            </Button>

            {selectedIntegrationId && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Label>Default Indexes</Label>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                                    <Info className="h-4 w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="flex flex-col gap-1">
                                    <span>Select log indexes to search by default</span>
                                    <span className="text-xs">At least one index must be selected</span>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </div>
                    {isLoadingIndexes ? (
                        <Skeleton className="h-32 w-full" />
                    ) : indexes.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No indexes found. Make sure your Datadog integration has access to log indexes.</p>
                    ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                            {indexes.map((index: DatadogIndex) => {
                                const isSelected = datadogConfig.defaultIndexes?.includes(index.id) || false
                                return (
                                    <div key={index.id} className="flex items-center space-x-2">
                                        <Checkbox id={`index-${index.id}`} checked={isSelected} onCheckedChange={() => toggleIndex(index.id)} />
                                        <Label htmlFor={`index-${index.id}`} className="font-normal cursor-pointer flex-1">
                                            {index.name}
                                            {index.retentionDays && <span className="text-xs text-muted-foreground ml-2">({index.retentionDays} days retention)</span>}
                                        </Label>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {datadogConfig.defaultIndexes.length > 0 && <p className="text-sm text-muted-foreground">Selected: {datadogConfig.defaultIndexes.join(", ")}</p>}
                </div>
            )}
        </div>
    )
}
