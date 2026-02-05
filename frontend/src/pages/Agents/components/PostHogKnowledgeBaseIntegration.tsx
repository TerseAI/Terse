import { useState } from "react"

import { AlertTriangleIcon, Eye, EyeOff, Info, Plus } from "lucide-react"

import { PosthogProjectSelector } from "@/components/PosthogProjectSelector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePosthogIntegrations } from "@/hooks/api/usePosthogIntegrations"
import { BackendProvider } from "@/services/backend"
import { PosthogConfig } from "@/shared/Configs"

import { KnowledgeBaseSelectorProps } from "./KnowledgeBaseSelector"

export function PostHogKnowledgeBaseIntegration({ knowledgeBase, variant, setConfig }: KnowledgeBaseSelectorProps) {
    const { integrations, isLoading, mutate } = usePosthogIntegrations()
    const posthogConfig = (knowledgeBase.config as PosthogConfig) || new PosthogConfig("", "")
    const selectedIntegrationId = posthogConfig.integrationId || null

    // Form state for connecting new integration
    const [showConnectForm, setShowConnectForm] = useState(false)
    const [apiKey, setApiKey] = useState("")
    const [showApiKey, setShowApiKey] = useState(false)
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
            await BackendProvider.createOrUpdatePosthogIntegration(apiKey)
            setShowConnectForm(false)
            setApiKey("")
            mutate() // Refresh integrations list
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect PostHog integration")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleCancel = () => {
        setShowConnectForm(false)
        setApiKey("")
        setError(null)
    }

    if (isLoading) {
        return <Skeleton className="h-20 w-full" />
    }

    // Card variant handling
    if (variant === "card") {
        if (integrations.length === 0) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertTriangleIcon className="size-3 text-yellow-500" />
                    Connect PostHog
                </div>
            )
        }
        const selectedIntegration = integrations.find(i => i.id === selectedIntegrationId)
        const hasProject = !!posthogConfig.projectId
        const displayText = hasProject ? posthogConfig.projectName || posthogConfig.projectId : selectedIntegration ? "Select project" : "Select integration"
        return <div className="text-xs text-center">{displayText}</div>
    }

    // Dialog variant - no integrations and not showing form
    if (integrations.length === 0 && !showConnectForm) {
        return (
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-dashed border-input bg-card">
                <div className="text-sm text-muted-foreground">No PostHog integrations connected. Connect your PostHog account to get started.</div>
                <Button onClick={handleConnect}>
                    <Plus className="w-4 h-4" />
                    Connect PostHog
                </Button>
            </div>
        )
    }

    // Show connect form
    if (showConnectForm) {
        return (
            <div className="space-y-4 p-4 rounded-lg border border-input bg-card">
                <form onSubmit={handleSubmit} className="space-y-4">
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
                                        <span>Get your API key from PostHog</span>
                                        <a href="https://us.posthog.com/project/user-api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
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
                                placeholder="Enter your PostHog API key"
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
                        <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        )
    }

    const updateIntegrationId = (integrationId: string) => {
        // When changing integration, clear project selection
        const newPosthogConfig = new PosthogConfig(
            integrationId,
            "" // Clear project when integration changes
        )
        setConfig(newPosthogConfig)
    }

    const updateProject = (projectId: string, projectName: string) => {
        const newPosthogConfig = new PosthogConfig(posthogConfig.integrationId, projectId, projectName)
        setConfig(newPosthogConfig)
    }
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>PostHog Integration</Label>
                <Select value={selectedIntegrationId || ""} onValueChange={updateIntegrationId}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select an integration" />
                    </SelectTrigger>
                    <SelectContent>
                        {integrations.map(integration => (
                            <SelectItem key={integration.id} value={integration.id}>
                                {integration.email || integration.id} {integration.orgName ? `(${integration.orgName})` : ""}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button onClick={handleConnect} variant="outline" size="sm">
                <Plus className="w-4 h-4" />
                Connect Another PostHog
            </Button>

            {/* Project selector - required */}
            {selectedIntegrationId && (
                <div className="space-y-2">
                    <Label>
                        Project <span className="text-destructive">*</span>
                    </Label>
                    <PosthogProjectSelector
                        integrationId={selectedIntegrationId}
                        selectedProjectId={posthogConfig.projectId}
                        selectedProjectName={posthogConfig.projectName}
                        onSelect={updateProject}
                    />
                    {!posthogConfig.projectId && <p className="text-sm text-muted-foreground">Please select a project to continue</p>}
                </div>
            )}
        </div>
    )
}
