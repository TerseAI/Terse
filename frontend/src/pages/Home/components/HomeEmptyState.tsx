import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, MessageSquare, Zap, GitBranch } from "lucide-react";
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

    return (
        <div className="mx-auto px-8 py-16 max-w-2xl">
            {/* Hero */}
            <div className="space-y-3 mb-12">
                <h1 className="text-3xl font-semibold tracking-tight">Welcome to Terse</h1>
                <p className="text-muted-foreground">
                    Build AI agents for your software team. Connect your tools, and automate workflows.
                </p>
            </div>

            {/* Setup checklist */}
            <div className="space-y-1 mb-12">
                <SetupItem
                    number={1}
                    title="Connect Slack"
                    description="Manage agents via chat"
                    done={hasSlackIntegration}
                    onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}
                    icon={<MessageSquare className="h-4 w-4" />}
                />
                <SetupItem
                    number={2}
                    title="Add integrations"
                    description="GitHub, Linear, and more"
                    done={false}
                    onClick={() => navigate(FrontendRoutes.INTEGRATIONS)}
                    icon={<GitBranch className="h-4 w-4" />}
                />
                <SetupItem
                    number={3}
                    title="Create an agent"
                    description="Automate your first workflow"
                    done={false}
                    onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                    icon={<Zap className="h-4 w-4" />}
                />
            </div>

            {/* Templates */}
            {!isLoadingTemplates && templates.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Or start from a template</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(FrontendRoutes.AGENTS.SETUP)}
                            className="text-muted-foreground"
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
    );
}

function SetupItem({
    number,
    title,
    description,
    done,
    onClick,
    icon,
}: {
    number: number;
    title: string;
    description: string;
    done: boolean;
    onClick: () => void;
    icon: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-4 p-3 -mx-3 rounded-lg hover:bg-muted/50 transition-colors text-left group"
        >
            <div className={`
                flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium
                ${done
                    ? 'bg-foreground text-background'
                    : 'border border-border text-muted-foreground'
                }
            `}>
                {done ? <Check className="h-4 w-4" /> : number}
            </div>
            <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{title}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            <div className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                {icon}
            </div>
        </button>
    );
}
