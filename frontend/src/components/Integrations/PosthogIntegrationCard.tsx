import { Card, CardContent, CardFooter } from "../ui/card";
import { PosthogIntegration, IntegrationType } from "@/shared/Integrations"
import { IntegrationCardHeader } from "./helpers/IntegrationCardHeader";
import { IntegrationItem } from "./helpers/IntegrationItem";
import { cn } from "@/lib/utils";
import { usePosthogIntegrations } from "@/hooks/api/usePosthogIntegrations";
import { Skeleton } from "../ui/skeleton";
import { Palette, Eye, EyeOff, Info } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { useState } from "react";
import { BackendProvider } from "@/services/backend";

function PosthogIntegrationCard({ className, isActive = true, stateToken, compact = false }: { className?: string; isActive?: boolean; stateToken?: string; compact?: boolean }) {
    const { integrations, isLoading, mutate } = usePosthogIntegrations();
    const [showForm, setShowForm] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleConnect = () => {
        setShowForm(true);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            await BackendProvider.createOrUpdatePosthogIntegration(apiKey, stateToken);
            setShowForm(false);
            setApiKey("");
            mutate(); // Refresh integrations list
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || "Failed to connect Posthog integration");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setApiKey("");
        setError(null);
    };

    return (
        <Card className={cn(className)}>
            <IntegrationCardHeader integration={IntegrationType.POSTHOG} isActive={isActive} compact={compact} />
            {!compact && (
                <CardContent>
                    {showForm ? (
                        <PosthogForm
                            apiKey={apiKey}
                            setApiKey={setApiKey}
                            showApiKey={showApiKey}
                            setShowApiKey={setShowApiKey}
                            onSubmit={handleSubmit}
                            onCancel={handleCancel}
                            isSubmitting={isSubmitting}
                            error={error}
                        />
                    ) : (
                        <PosthogCardContent integrations={integrations} isLoading={isLoading} />
                    )}
                </CardContent>
            )}
            <CardFooter className={cn(compact && "py-3 px-4")}>
                {!showForm && (
                    <Button variant="outline" size={compact ? "sm" : "default"} onClick={handleConnect}>
                        {compact ? "Connect" : (integrations.length > 0 ? "Update" : "Connect")}
                    </Button>
                )}
            </CardFooter>
        </Card>
    )
}

function PosthogCardContent({ integrations, isLoading }: { integrations: Array<PosthogIntegration>, isLoading: boolean }) {
    if (isLoading) {
        return (
            <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        );
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Palette className="w-10 h-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No Posthog integrations connected</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect your Posthog account to get started</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {integrations.map((integration) => (
                <IntegrationItem
                    key={integration.id}
                    icon={<Palette className="w-4 h-4" />}
                    title={integration.email || integration.id}
                    description={integration.orgName ? `Organization: ${integration.orgName}` : "Posthog account"}
                />
            ))}
        </div>
    );
}

function PosthogForm({
    apiKey,
    setApiKey,
    showApiKey,
    setShowApiKey,
    onSubmit,
    onCancel,
    isSubmitting,
    error,
}: {
    apiKey: string;
    setApiKey: (value: string) => void;
    showApiKey: boolean;
    setShowApiKey: (value: boolean) => void;
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    isSubmitting: boolean;
    error: string | null;
}) {
    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <Info className="h-4 w-4" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="flex flex-col gap-1">
                                <span>Get your API key from PostHog</span>
                                <a
                                    href="https://us.posthog.com/project/user-api-keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:no-underline"
                                >
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
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your Posthog API key"
                        disabled={isSubmitting}
                        required
                        className="pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        disabled={isSubmitting}
                    >
                        {showApiKey ? (
                            <EyeOff className="h-4 w-4" />
                        ) : (
                            <Eye className="h-4 w-4" />
                        )}
                        
                    </button>
                </div>
                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
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
    );
}

export default PosthogIntegrationCard;

