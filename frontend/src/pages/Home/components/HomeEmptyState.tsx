import { useNavigate } from "react-router-dom";
import { Plug, Zap, ArrowRight, MessageSquare, Bot, Sparkles, CheckCircle2 } from "lucide-react";
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
    const hasSlackIntegration = activeIntegrations?.some(
        (integration) => integration.type.toLowerCase() === 'slack'
    );

    return (
        <div className="mx-auto p-8 space-y-10 max-w-4xl">
            {/* Hero Section */}
            <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    <Sparkles className="h-4 w-4" />
                    AI-Powered Automation for Software Teams
                </div>
                <h1 className="text-4xl font-bold tracking-tight">Welcome to Terse</h1>
                <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                    Build intelligent agents that automate your software development workflows.
                    Connect your tools, define triggers, and let AI handle the rest.
                </p>
            </div>

            {/* What Terse Does */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-3">
                        <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-medium mb-1">Build Agents</h3>
                    <p className="text-sm text-muted-foreground">
                        Create AI agents that understand your codebase and workflows
                    </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-3">
                        <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-medium mb-1">Automate Tasks</h3>
                    <p className="text-sm text-muted-foreground">
                        Trigger actions from GitHub, Linear, Slack, and more
                    </p>
                </div>
                <div className="flex flex-col items-center text-center p-4 rounded-lg bg-muted/30">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 mb-3">
                        <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-medium mb-1">Chat in Slack</h3>
                    <p className="text-sm text-muted-foreground">
                        Manage and interact with all your agents directly in Slack
                    </p>
                </div>
            </div>

            {/* Setup Steps */}
            <div className="space-y-4">
                <div className="text-center">
                    <h2 className="text-xl font-semibold">Get Started</h2>
                    <p className="text-sm text-muted-foreground">
                        Follow these steps to set up your first agent
                    </p>
                </div>

                <div className="space-y-3">
                    {/* Step 1: Connect Slack */}
                    <Card className={`transition-all ${!hasSlackIntegration ? 'border-primary/50 ring-1 ring-primary/20' : 'border-green-500/30'}`}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${hasSlackIntegration ? 'bg-green-500/10' : 'bg-primary/10'}`}>
                                    {hasSlackIntegration ? (
                                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                                    ) : (
                                        <MessageSquare className="h-6 w-6 text-primary" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 1</span>
                                        {hasSlackIntegration && (
                                            <span className="text-xs font-medium text-green-500">Connected</span>
                                        )}
                                    </div>
                                    <CardTitle className="text-base">Connect Slack</CardTitle>
                                    <CardDescription className="text-sm">
                                        {hasSlackIntegration
                                            ? "You can manage all your Terse agents directly in Slack via our chatbot"
                                            : "Connect Slack to manage your agents via chat and receive notifications"
                                        }
                                    </CardDescription>
                                </div>
                                {isLoadingIntegrations ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                ) : (
                                    <Button
                                        variant={hasSlackIntegration ? "outline" : "default"}
                                        size="sm"
                                        onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}
                                    >
                                        {hasSlackIntegration ? 'Manage' : 'Connect'}
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 2: Connect Other Integrations */}
                    <Card className={`transition-all ${hasSlackIntegration && !hasActiveIntegrations ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${hasActiveIntegrations && activeIntegrations.length > 1 ? 'bg-green-500/10' : 'bg-muted'}`}>
                                    {hasActiveIntegrations && activeIntegrations.length > 1 ? (
                                        <CheckCircle2 className="h-6 w-6 text-green-500" />
                                    ) : (
                                        <Plug className="h-6 w-6 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 2</span>
                                        {hasActiveIntegrations && activeIntegrations.length > 1 && (
                                            <span className="text-xs font-medium text-green-500">{activeIntegrations.length} connected</span>
                                        )}
                                    </div>
                                    <CardTitle className="text-base">Connect Your Tools</CardTitle>
                                    <CardDescription className="text-sm">
                                        Add GitHub, Linear, and other integrations to enable powerful automations
                                    </CardDescription>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}
                                >
                                    Add
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Step 3: Create Agent */}
                    <Card className={`transition-all ${hasActiveIntegrations ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                                    <Zap className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 3</span>
                                    <CardTitle className="text-base">Create Your First Agent</CardTitle>
                                    <CardDescription className="text-sm">
                                        Build an AI agent that listens for events and takes intelligent actions
                                    </CardDescription>
                                </div>
                                <Button
                                    variant={hasActiveIntegrations ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                                >
                                    Create
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Templates Section */}
            {isLoadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : templates.length > 0 ? (
                <div className="space-y-4">
                    <div className="text-center">
                        <h2 className="text-xl font-semibold">Or Start with a Template</h2>
                        <p className="text-sm text-muted-foreground">
                            Pre-configured agents for common software team workflows
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
