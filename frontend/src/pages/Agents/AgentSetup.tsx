import { useNavigate } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { useTemplates } from '@/hooks/api/useTemplates';
import { TemplateCard } from '@/components/Agents/TemplateCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function AgentSetup() {
    const navigate = useNavigate();
    const { templates, isLoading } = useTemplates();

    const handleStartFromScratch = () => {
        navigate('/app/agents/new');
    };

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto space-y-8 max-w-5xl">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Create a New Channel</h1>
                        <p className="text-muted-foreground mt-1">
                            Choose a template to get started quickly, or start from scratch with a blank channel.
                        </p>
                    </div>

                    {/* Templates Section */}
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold">Start with a template</h2>
                            <p className="text-sm text-muted-foreground">
                                Pre-configured channels for common workflows
                            </p>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : templates.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {templates.map((template, index) => (
                                    <TemplateCard
                                        key={index}
                                        template={template}
                                        templateIndex={index}
                                    />
                                ))}
                            </div>
                        ) : (
                            <Card className="border-dashed">
                                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                                    <p className="text-muted-foreground">
                                        No templates available yet
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-sm text-muted-foreground">or</span>
                        <div className="h-px flex-1 bg-border" />
                    </div>

                    {/* Start from Scratch Section */}
                    <Card
                        className="cursor-pointer transition-colors hover:bg-accent/50"
                        onClick={handleStartFromScratch}
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
            </div>
        </div>
    );
}
