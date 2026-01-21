import { useState, useEffect } from "react";
import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { IntegrationType } from "@/shared/Integrations";
import { IconForIntegration } from "@/pages/Channels/components/Integration";
import { Input } from "../../components/ui/input";

export type AvailableTool = {
    name: string;
    description: string;
    integration: IntegrationType;
    isReadOnly: boolean;
};

export type ToolApprovalSelectorProps = {
    tools: AvailableTool[];
    selectedTools: Set<string>; // Tool names that require approval
    onChange: (toolName: string, requiresApproval: boolean) => void;
    isLoading?: boolean;
};

function ToolApprovalSelector({ tools, selectedTools, onChange, isLoading = false }: ToolApprovalSelectorProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [filteredTools, setFilteredTools] = useState(tools);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredTools(tools);
            return;
        }

        const query = searchQuery.toLowerCase();
        setFilteredTools(
            tools.filter(
                tool =>
                    tool.name.toLowerCase().includes(query) ||
                    tool.description.toLowerCase().includes(query) ||
                    tool.integration.toLowerCase().includes(query)
            )
        );
    }, [searchQuery, tools]);

    // Group tools by integration
    const toolsByIntegration = filteredTools.reduce((acc, tool) => {
        if (!acc[tool.integration]) {
            acc[tool.integration] = [];
        }
        acc[tool.integration].push(tool);
        return acc;
    }, {} as Record<IntegrationType, AvailableTool[]>);

    const handleToggle = (toolName: string, checked: boolean) => {
        onChange(toolName, checked);
    };

    const handleSelectAll = () => {
        filteredTools.forEach(tool => {
            if (!selectedTools.has(tool.name)) {
                onChange(tool.name, true);
            }
        });
    };

    const handleDeselectAll = () => {
        filteredTools.forEach(tool => {
            if (selectedTools.has(tool.name)) {
                onChange(tool.name, false);
            }
        });
    };

    const allSelected = filteredTools.length > 0 && filteredTools.every(t => selectedTools.has(t.name));
    const someSelected = filteredTools.some(t => selectedTools.has(t.name));

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Loading tools...</div>
            </div>
        );
    }

    if (tools.length === 0) {
        return (
            <div className="flex flex-col gap-4 p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">No writable tools available. Add outputs to configure tool approvals.</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-lg">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <Label className="text-base font-medium">
                            Tool-specific approval settings
                        </Label>
                        <p className="text-sm text-muted-foreground">
                            Select which tools require approval before execution. Only writable tools are shown.
                        </p>
                    </div>
                </div>

                {filteredTools.length > 0 && (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            disabled={allSelected}
                            className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                        >
                            Select all
                        </button>
                        <span className="text-muted-foreground">•</span>
                        <button
                            type="button"
                            onClick={handleDeselectAll}
                            disabled={!someSelected}
                            className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                        >
                            Deselect all
                        </button>
                    </div>
                )}

                {tools.length > 5 && (
                    <Input
                        type="text"
                        placeholder="Search tools by name, description, or integration..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-md"
                    />
                )}
            </div>

            <div className="flex flex-col gap-4">
                {Object.entries(toolsByIntegration).map(([integration, integrationTools]) => (
                    <Card key={integration}>
                        <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5">
                                    <IconForIntegration integration={integration as IntegrationType} />
                                </div>
                                <CardTitle className="text-sm font-medium capitalize">
                                    {integration.replace(/_/g, ' ')}
                                </CardTitle>
                                <Badge variant="secondary" className="ml-auto">
                                    {integrationTools.length} {integrationTools.length === 1 ? 'tool' : 'tools'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="flex flex-col gap-3">
                                {integrationTools.map((tool) => (
                                    <div
                                        key={tool.name}
                                        className="flex items-start justify-between gap-4 p-3 rounded-lg border"
                                    >
                                        <div className="flex-1 flex flex-col gap-1">
                                            <Label
                                                htmlFor={`tool-${tool.name}`}
                                                className="text-sm font-medium"
                                            >
                                                {tool.name}
                                            </Label>
                                            {tool.description && (
                                                <p className="text-xs text-muted-foreground">
                                                    {tool.description}
                                                </p>
                                            )}
                                        </div>
                                        <Switch
                                            id={`tool-${tool.name}`}
                                            checked={selectedTools.has(tool.name)}
                                            onCheckedChange={(checked) => handleToggle(tool.name, checked)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {filteredTools.length === 0 && searchQuery && (
                <div className="text-sm text-muted-foreground text-center py-4">
                    No tools found matching "{searchQuery}"
                </div>
            )}
        </div>
    );
}

export default ToolApprovalSelector;
