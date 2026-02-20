import { useState } from "react"

import { CheckIcon, CopyIcon, ExternalLinkIcon, Eye, EyeOff, Shield } from "lucide-react"

import { useWorkOSIntegrations } from "@/hooks/api/useWorkOSIntegrations"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { INTEGRATION_METADATA, IntegrationType, WorkOSIntegration } from "@/shared/Integrations"

import { Button } from "../ui/button"
import { Card, CardContent, CardFooter } from "../ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Skeleton } from "../ui/skeleton"

import { CompactIntegrationRow } from "./CompactIntegrationRow"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader"
import { IntegrationItem } from "./helpers/IntegrationItem"

const backendUrl = import.meta.env.VITE_BACKEND_REDIRECT_URL || window.location.origin + "/api"

function buildWebhookUrl(integrationId: string): string {
    return `${backendUrl}/webhooks/workos-trigger/${integrationId}`
}

function WorkOSIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, isLoading, mutate } = useWorkOSIntegrations()
    const [showForm, setShowForm] = useState(false)
    const [step, setStep] = useState<1 | 2>(1)
    const [apiKey, setApiKey] = useState("")
    const [webhookSecret, setWebhookSecret] = useState("")
    const [showApiKey, setShowApiKey] = useState(false)
    const [showWebhookSecret, setShowWebhookSecret] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [webhookUrl, setWebhookUrl] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    const isConnected = integrations.length > 0

    const handleConnect = () => {
        setShowForm(true)
        setStep(1)
        setError(null)
        setWebhookUrl(null)
    }

    const handleManage = () => {
        setShowForm(true)
        setError(null)
        if (integrations[0]) {
            setStep(2)
            setWebhookUrl(integrations[0].webhookUrl || buildWebhookUrl(integrations[0].id))
        } else {
            setStep(1)
            setWebhookUrl(null)
        }
    }

    const handleSubmitApiKey = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            const result = await BackendProvider.createOrUpdateWorkOSIntegration(apiKey, undefined, stateToken)
            setWebhookUrl(result.webhookUrl)
            setStep(2)
            mutate()
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect WorkOS integration")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleSubmitWebhookSecret = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setIsSubmitting(true)

        try {
            await BackendProvider.updateWorkOSWebhookSecret(webhookSecret, stateToken)
            setWebhookSecret("")
            mutate()
            handleClose()
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to save webhook secret")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setShowForm(false)
        setStep(1)
        setApiKey("")
        setWebhookSecret("")
        setShowApiKey(false)
        setShowWebhookSecret(false)
        setError(null)
        setWebhookUrl(null)
    }

    const summary = integrations[0]?.environment ?? undefined

    const formDialog = (
        <Dialog open={showForm} onOpenChange={open => !open && handleClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {isConnected ? "Manage" : "Connect"} {INTEGRATION_METADATA[IntegrationType.WORKOS].name}
                    </DialogTitle>
                    <DialogDescription>{step === 1 ? "Step 1: Connect your WorkOS account with an API key." : "Step 2: Configure a webhook to start receiving events."}</DialogDescription>
                </DialogHeader>

                {/* Step indicator */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div
                        className={cn("flex items-center justify-center size-5 rounded-full text-[10px] font-medium", step === 1 ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary")}
                    >
                        {step > 1 ? <CheckIcon className="size-3" /> : "1"}
                    </div>
                    <span className={cn(step === 1 ? "text-foreground font-medium" : "text-muted-foreground")}>API Key</span>
                    <div className="flex-1 h-px bg-border" />
                    <div
                        className={cn(
                            "flex items-center justify-center size-5 rounded-full text-[10px] font-medium",
                            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}
                    >
                        2
                    </div>
                    <span className={cn(step === 2 ? "text-foreground font-medium" : "text-muted-foreground")}>Webhook</span>
                </div>

                {step === 1 ? (
                    <form onSubmit={handleSubmitApiKey} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="apiKey">API Key</Label>
                            <div className="relative">
                                <Input
                                    id="apiKey"
                                    type={showApiKey ? "text" : "password"}
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    placeholder="sk_live_..."
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
                            <p className="text-xs text-muted-foreground">
                                Found under{" "}
                                <a href="https://dashboard.workos.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
                                    API Keys
                                </a>{" "}
                                in your WorkOS Dashboard.
                            </p>
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <div className="flex gap-2">
                            <Button type="submit" disabled={isSubmitting || !apiKey}>
                                {isSubmitting ? "Connecting..." : "Continue"}
                            </Button>
                            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                                Cancel
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1.5">
                            <li>
                                Go to{" "}
                                <a
                                    href="https://dashboard.workos.com/webhooks"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline text-foreground hover:text-primary inline-flex items-center gap-0.5"
                                >
                                    Webhooks <ExternalLinkIcon className="size-3" />
                                </a>{" "}
                                in your WorkOS Dashboard
                            </li>
                            <li>Create a new endpoint with the URL below</li>
                            <li>Select the events you want to receive</li>
                            <li>Copy the signing secret and paste it below</li>
                        </ol>

                        <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-muted rounded text-xs break-all">{webhookUrl}</code>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 gap-1.5"
                                    onClick={() => {
                                        navigator.clipboard.writeText(webhookUrl!)
                                        setCopied(true)
                                        setTimeout(() => setCopied(false), 2000)
                                    }}
                                >
                                    {copied ? (
                                        <>
                                            <CheckIcon className="size-3.5 text-green-500" /> Copied
                                        </>
                                    ) : (
                                        <>
                                            <CopyIcon className="size-3.5" /> Copy
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmitWebhookSecret} className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="webhookSecret">Webhook Signing Secret</Label>
                                <div className="relative">
                                    <Input
                                        id="webhookSecret"
                                        type={showWebhookSecret ? "text" : "password"}
                                        value={webhookSecret}
                                        onChange={e => setWebhookSecret(e.target.value)}
                                        placeholder="Paste the signing secret from WorkOS"
                                        disabled={isSubmitting}
                                        className="pr-10"
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        disabled={isSubmitting}
                                    >
                                        {showWebhookSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground">WorkOS shows the signing secret after creating the webhook endpoint.</p>
                            </div>

                            {error && <p className="text-sm text-destructive">{error}</p>}

                            <div className="flex gap-2">
                                <Button type="submit" disabled={isSubmitting || !webhookSecret}>
                                    {isSubmitting ? "Saving..." : "Save Secret"}
                                </Button>
                                <Button type="button" variant="outline" onClick={handleClose}>
                                    {isConnected ? "Done" : "Skip for Now"}
                                </Button>
                            </div>
                        </form>

                        {isConnected && (
                            <button type="button" onClick={() => setStep(1)} className="text-xs text-muted-foreground underline hover:text-primary">
                                Update API Key
                            </button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )

    if (compact) {
        return (
            <>
                <CompactIntegrationRow
                    integration={IntegrationType.WORKOS}
                    isConnected={isConnected}
                    summary={summary}
                    connect={isConnected ? handleManage : handleConnect}
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
                <IntegrationCardHeader integration={IntegrationType.WORKOS} isActive={isActive} />
                <CardContent>
                    <WorkOSCardContent integrations={integrations} isLoading={isLoading} mutate={mutate} />
                </CardContent>
                <CardFooter>
                    <Button variant="outline" onClick={isConnected ? handleManage : handleConnect}>
                        {isConnected ? "Manage" : "Connect"}
                    </Button>
                </CardFooter>
            </Card>
            {formDialog}
        </>
    )
}

function WorkOSCardContent({ integrations, isLoading, mutate }: { integrations: Array<WorkOSIntegration>; isLoading: boolean; mutate: () => void }) {
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
                <Shield className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No WorkOS integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your WorkOS account to trigger agents on user lifecycle events</p>
            </div>
        )
    }

    const handleDelete = async (integrationId: string) => {
        await BackendProvider.deleteIntegration(IntegrationType.WORKOS, integrationId)
        mutate()
    }

    return (
        <div className="space-y-2">
            {integrations.map(integration => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Shield className="w-4 h-4" />}
                    title="WorkOS"
                    description={integration.environment === "test" ? "Test environment" : integration.environment === "live" ? "Production environment" : "WorkOS user lifecycle events"}
                    onDelete={() => handleDelete(integration.id)}
                    deleteConfirmTitle="Remove WorkOS Connection"
                    deleteConfirmDescription={`Are you sure you want to remove the WorkOS connection? This action cannot be undone.`}
                />
            ))}
        </div>
    )
}

export default WorkOSIntegrationCard
