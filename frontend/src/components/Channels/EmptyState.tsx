import { Plus, Settings, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
import { useNavigate } from "react-router-dom";
import { useTemplates } from "@/hooks/api/useTemplates";
import { TemplateCard } from "@/components/Channels/TemplateCard";

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
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <Settings className="text-primary" />
                        </EmptyMedia>
                        <EmptyTitle>No channels yet</EmptyTitle>
                        <EmptyDescription>
                            Create your first channel to start automating your workflow
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button
                            variant="default"
                            onClick={() => navigate('/app/channels/setup')}
                        >
                            <Plus className="h-4 w-4" />
                            Create Channel
                        </Button>
                    </EmptyContent>
                </Empty>

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
                                    onClick={() => navigate('/app/channels/setup')}
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
