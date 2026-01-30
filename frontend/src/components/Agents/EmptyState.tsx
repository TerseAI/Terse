import { Plus, Settings, ArrowRight, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useTemplates } from "@/hooks/api/useTemplates";
import { TemplateCard } from "@/components/Agents/TemplateCard";
import { FrontendRoutes } from "@/shared/FrontendRoutes";

interface EmptyStateProps {
    hasFilters: boolean;
    onCreateNew?: () => void;
}

export function EmptyState({ hasFilters }: EmptyStateProps) {
    const navigate = useNavigate();
    const { templates, isLoading: isLoadingTemplates } = useTemplates();

    // If no filters, show empty state with templates
    if (!hasFilters) {
        return (
            <div className="space-y-8">
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
                                    onSelect={() => navigate(FrontendRoutes.AGENTS.SETUP, { state: { template } })}
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

                {/* Divider */}
                <div className="flex items-center gap-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-sm text-muted-foreground">or</span>
                    <div className="h-px flex-1 bg-border" />
                </div>

                {/* Start from Scratch Section */}
                <Card
                    className="cursor-pointer transition-colors hover:bg-accent/50"
                    onClick={() => navigate(FrontendRoutes.AGENTS.NEW)}
                >
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Start from scratch</CardTitle>
                                <CardDescription>
                                    Create a custom channel with your own configuration
                                </CardDescription>
                            </div>
                            <div className="ml-auto">
                                <Plus className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </div>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <Empty>
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <Settings className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>No channels found</EmptyTitle>
                <EmptyDescription>
                    Try adjusting your search or filters
                </EmptyDescription>
            </EmptyHeader>
        </Empty>
    );
}
