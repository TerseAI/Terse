import { useState } from "react";
import { IntegrationType } from "@/shared/Integrations";
import { IconForIntegration } from "@/pages/Channels/components/Integration";
import { Button } from "../../components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Badge } from "../../components/ui/badge";

export type AvailableTool = {
    name: string;
    displayName: string;
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
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const filteredTools = tools.filter(tool => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return tool.displayName.toLowerCase().includes(query) || 
               tool.integration.toLowerCase().includes(query);
    });

    const handleToggle = (toolName: string) => {
        const isSelected = selectedTools.has(toolName);
        onChange(toolName, !isSelected);
    };

    const handleRemove = (toolName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(toolName, false);
    };

    const selectedCount = selectedTools.size;

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Loading actions...</div>
            </div>
        );
    }

    if (tools.length === 0) {
        return (
            <div className="flex flex-col gap-4 p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">Add skills to your agent to configure action approvals.</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-lg">
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                        <label className="text-base font-medium">
                            Approvals
                        </label>
                        <p className="text-sm text-muted-foreground">
                            Select which actions require approval.
                        </p>
                    </div>
                </div>
            </div>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between"
                    >
                        <span className="text-muted-foreground">
                            {selectedCount === 0 
                                ? "Select actions..." 
                                : `${selectedCount} action${selectedCount === 1 ? '' : 's'} selected`}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                    <Command>
                        <CommandInput 
                            placeholder="Search actions..." 
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                        />
                        <CommandList>
                            <CommandEmpty>No actions found.</CommandEmpty>
                            <CommandGroup>
                                {filteredTools.map((tool) => {
                                    const isSelected = selectedTools.has(tool.name);
                                    return (
                                        <CommandItem
                                            key={tool.name}
                                            value={tool.name}
                                            onSelect={() => handleToggle(tool.name)}
                                            className="flex items-center gap-2"
                                        >
                                            <div className="w-5 h-5 flex-shrink-0">
                                                <IconForIntegration integration={tool.integration} />
                                            </div>
                                            <span className="flex-1">{tool.displayName}</span>
                                            <Check
                                                className={cn(
                                                    "h-4 w-4 flex-shrink-0",
                                                    isSelected ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>

            {selectedCount > 0 && (
                <div className="flex flex-wrap gap-2">
                    {Array.from(selectedTools).map(toolName => {
                        const tool = tools.find(t => t.name === toolName);
                        if (!tool) return null;
                        return (
                            <Badge
                                key={toolName}
                                variant="secondary"
                                className="flex items-center gap-1.5 px-2 py-1"
                            >
                                <div className="w-4 h-4 flex-shrink-0">
                                    <IconForIntegration integration={tool.integration} />
                                </div>
                                <span>{tool.displayName}</span>
                                <button
                                    type="button"
                                    onClick={(e) => handleRemove(toolName, e)}
                                    className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </Badge>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ToolApprovalSelector;
