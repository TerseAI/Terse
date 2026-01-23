import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, MessageSquare, Zap, GitBranch, Bot, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTemplates } from "@/hooks/api/useTemplates";
import { useIntegrations } from "@/hooks/api/useIntegrations";
import { TemplateCard } from "@/components/Agents/TemplateCard";
import { FrontendRoutes } from "@/shared/FrontendRoutes";

export function HomeEmptyState() {
    const navigate = useNavigate();
    const { templates, isLoading: isLoadingTemplates } = useTemplates();
    const { integrations: activeIntegrations } = useIntegrations();

    const hasSlackIntegration = activeIntegrations?.some(
        (integration) => integration.type.toLowerCase() === 'slack'
    );
    const hasOtherIntegrations = activeIntegrations && activeIntegrations.length > (hasSlackIntegration ? 1 : 0);

    return (
        <div className="mx-auto px-6 py-10 max-w-5xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight mb-1">Get started with Terse</h1>
                    <p className="text-muted-foreground text-sm">
                        AI agents that automate your software workflows
                    </p>
                </div>
                <Button onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}>
                    <Zap className="h-4 w-4" />
                    Create Agent
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column - Setup */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Setup cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <SetupCard
                            icon={<MessageSquare className="h-5 w-5" />}
                            title="Connect Slack"
                            description="Chat with your agents and get notifications directly in Slack"
                            done={hasSlackIntegration}
                            buttonText={hasSlackIntegration ? "Connected" : "Connect"}
                            onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}
                            highlight={!hasSlackIntegration}
                        />
                        <SetupCard
                            icon={<GitBranch className="h-5 w-5" />}
                            title="Add integrations"
                            description="Connect GitHub, Linear, and other tools to trigger automations"
                            done={hasOtherIntegrations}
                            buttonText="Add"
                            onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}
                        />
                    </div>

                    {/* Templates */}
                    {!isLoadingTemplates && templates.length > 0 && (
                        <div className="border border-border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium text-sm">Start from a template</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                                    className="text-muted-foreground h-7 text-xs"
                                >
                                    View all
                                    <ArrowRight className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {templates.slice(0, 4).map((template, index) => (
                                    <TemplateCard
                                        key={index}
                                        template={template}
                                        templateIndex={index}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right column - What are agents */}
                <div className="space-y-4">
                    <div className="border border-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium text-sm">What are agents?</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            Agents are AI-powered automations that listen for events and take action on your behalf.
                        </p>
                        <div className="space-y-3">
                            <FeatureItem
                                title="Event-driven"
                                description="Trigger on GitHub PRs, Linear issues, Slack messages"
                            />
                            <FeatureItem
                                title="AI-powered"
                                description="Agents understand context and make smart decisions"
                            />
                            <FeatureItem
                                title="Slack-native"
                                description="Manage everything through natural conversation"
                            />
                        </div>
                    </div>

                    {/* Quick tip */}
                    <div className="bg-muted/50 rounded-lg p-4">
                        <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">Tip:</span> Connect Slack first to manage your agents via chat commands like <code className="bg-muted px-1 py-0.5 rounded text-[11px]">/terse create</code>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SetupCard({
    icon,
    title,
    description,
    done,
    buttonText,
    onClick,
    highlight,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    done?: boolean;
    buttonText: string;
    onClick: () => void;
    highlight?: boolean;
}) {
    return (
        <div
            className={`
                border rounded-lg p-4 flex flex-col gap-3
                ${highlight ? 'border-foreground/20 bg-muted/30' : 'border-border'}
            `}
        >
            <div className="flex items-start justify-between">
                <div className={`
                    flex h-9 w-9 items-center justify-center rounded-lg
                    ${done ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}
                `}>
                    {done ? <Check className="h-4 w-4" /> : icon}
                </div>
                {highlight && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Recommended
                    </span>
                )}
            </div>
            <div>
                <h3 className="font-medium text-sm mb-1">{title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
            </div>
            <Button
                variant={done ? "outline" : highlight ? "default" : "outline"}
                size="sm"
                onClick={onClick}
                className="w-full mt-auto"
                disabled={done}
            >
                {done && <Check className="h-3 w-3" />}
                {buttonText}
                {!done && <ArrowRight className="h-3 w-3" />}
            </Button>
        </div>
    );
}

function FeatureItem({ title, description }: { title: string; description: string }) {
    return (
        <div className="flex gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
            <div>
                <div className="text-sm font-medium">{title}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
        </div>
    );
}
