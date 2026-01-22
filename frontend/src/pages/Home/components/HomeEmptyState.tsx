import { useNavigate } from "react-router-dom";
import { Plug, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useTemplates } from "@/hooks/api/useTemplates";
import { useIntegrations } from "@/hooks/api/useIntegrations";
import { TemplateCard } from "@/components/Agents/TemplateCard";
import { Loader2 } from "lucide-react";
import { FrontendRoutes } from "@/shared/FrontendRoutes";

export function HomeEmptyState() {
    const navigate = useNavigate();
    const { templates, isLoading: isLoadingTemplates } = useTemplates();
    const { integrations: activeIntegrations, isLoading: isLoadingIntegrations } = useIntegrations();

    const hasActiveIntegrations = activeIntegrations && activeIntegrations.length > 0;

    return (
        <div className="mx-auto p-8 space-y-8 max-w-5xl">
            {/* Welcome Header */}
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold">Welcome to Terse</h1>
                <p className="text-muted-foreground text-lg">
                    Let's get you set up with your first automation channel
                </p>
            </div>

            {/* Setup Steps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Step 1: Set up integrations */}
                <Card className={`transition-colors ${!hasActiveIntegrations ? 'border-primary/50 bg-primary/5' : ''}`}>
                    <CardHeader>
                        <div className="flex items-start gap-4">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${hasActiveIntegrations ? 'bg-green-500/10' : 'bg-muted'}`}>
                                <Plug className={`h-5 w-5 ${hasActiveIntegrations ? 'text-green-500' : 'text-primary'}`} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 1</span>
                                    {hasActiveIntegrations && (
                                        <span className="text-xs font-medium text-green-500">✓ Complete</span>
                                    )}
                                </div>
                                <CardTitle className="text-lg">Connect your integrations</CardTitle>
                                <CardDescription>
                                    {hasActiveIntegrations
                                        ? `You have ${activeIntegrations.length} integration${activeIntegrations.length > 1 ? 's' : ''} connected`
                                        : 'Connect apps like Slack, GitHub, Linear, and more to enable automation triggers and actions'
                                    }
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingIntegrations ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <Button
                                variant={hasActiveIntegrations ? "outline" : "default"}
                                onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}
                                className="w-full"
                            >
                                <Plug className="h-4 w-4" />
                                {hasActiveIntegrations ? 'Manage Integrations' : 'Set Up Integrations'}
                                <ArrowRight className="h-4 w-4 ml-auto" />
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Step 2: Create a channel */}
                <Card className={`transition-colors ${hasActiveIntegrations ? 'border-primary/50 bg-primary/5' : ''}`}>
                    <CardHeader>
                        <div className="flex items-start gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                                <Zap className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 2</span>
                                <CardTitle className="text-lg">Create your first channel</CardTitle>
                                <CardDescription>
                                    Channels are automations that listen for events and take action using AI
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant={hasActiveIntegrations ? "default" : "outline"}
                            onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                            className="w-full"
                        >
                            <Zap className="h-4 w-4" />
                            Create Channel
                            <ArrowRight className="h-4 w-4 ml-auto" />
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Templates Section */}
            {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : templates.length > 0 ? (
                <div className="space-y-4">
                    <div>
                        <h2 className="text-xl font-semibold">Quick start with a template</h2>
                        <p className="text-sm text-muted-foreground">
                            Pre-configured channels for common workflows
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.slice(0, 6).map((template, index) => (
                            <TemplateCard
                                key={index}
                                template={template}
                                templateIndex={index}
                            />
                        ))}
                    </div>
                    {templates.length > 6 && (
                        <div className="text-center">
                            <Button
                                variant="ghost"
                                onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                            >
                                View all templates
                                <ArrowRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
