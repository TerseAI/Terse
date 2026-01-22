import { useState, useEffect } from "react";
import { Label } from "../../components/ui/label";
import { TransientAgentOutput, TransientKnowledgeBase } from "@/shared/types";
import { BackendProvider } from "@/services/backend";
import { TerseTool } from "@/shared/ToolsTypes";
import { IconForConfigType } from "./components/Integration";
import { Loader2 } from "lucide-react";
import { MultiSelect, type MultiSelectOption } from "../../components/MultiSelect";

export type AgentApprovalSettingsProps = {
    outputs: TransientAgentOutput[];
    knowledgeBases: TransientKnowledgeBase[];
    toolApprovals: string[];
    onToolApprovalsChange: (toolApprovals: string[]) => void;
};

function ApprovalSettingsCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-2 p-4 border rounded-lg">
            <div className="flex flex-col gap-1">
                <Label className="text-base font-medium">Approval Settings</Label>
                {children}
            </div>
        </div>
    );
}

function toolToOption(tool: TerseTool): MultiSelectOption {
    return { id: tool.name, label: tool.displayName };
}

function AgentApprovalSettings({
    outputs,
    knowledgeBases,
    toolApprovals,
    onToolApprovalsChange,
}: AgentApprovalSettingsProps) {
    const [toolsThatRequireApprovals, setToolsThatRequireApprovals] = useState<TerseTool[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const outputConfigTypes = outputs
        .filter((output) => output.config && output.config.isComplete())
        .map((output) => output.configType);

    const knowledgeBaseConfigTypes = knowledgeBases
        .filter((kb) => kb.config && kb.config.isComplete())
        .map((kb) => kb.configType);

    useEffect(() => {
        if (outputConfigTypes.length === 0) {
            setToolsThatRequireApprovals([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        BackendProvider.getToolsThatRequireApprovals({
            skills: outputConfigTypes,
            knowledgeBases: knowledgeBaseConfigTypes,
        })
            .then((response) => {
                setToolsThatRequireApprovals(response.tools);
                setIsLoading(false);
            })
            .catch((err) => {
                console.error("Error fetching tools that require approvals:", err);
                setError("Failed to load tools that require approvals");
                setIsLoading(false);
            });
    }, [outputConfigTypes.join(","), knowledgeBaseConfigTypes.join(",")]);

    const options = toolsThatRequireApprovals.map(toolToOption);

    const renderBody = () => {
        if (outputConfigTypes.length === 0) {
            return (
                <p className="text-sm text-muted-foreground">
                    Configure skills and knowledge bases to select which tools require approval.
                </p>
            );
        }

        if (isLoading) {
            return (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading tools that require approvals...</span>
                </div>
            );
        }

        if (error) {
            return <p className="text-sm text-destructive">{error}</p>;
        }

        if (toolsThatRequireApprovals.length === 0) {
            return (
                <p className="text-sm text-muted-foreground">
                    No write-only tools for the configured skills and knowledge bases.
                </p>
            );
        }

        const toolMap = new Map(toolsThatRequireApprovals.map((t) => [t.name, t]));

        return (
            <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Tools requiring approval</Label>
                <MultiSelect
                    options={options}
                    selectedIds={toolApprovals}
                    onSelect={(ids) => onToolApprovalsChange(ids as string[])}
                    placeholder="Select tools..."
                    searchPlaceholder="Search tools..."
                    emptyMessage="No tools found."
                    displayText={(count) =>
                        count > 0
                            ? `${count} tool${count !== 1 ? "s" : ""} selected`
                            : "Select tools..."
                    }
                    renderItem={(option) => {
                        const tool = toolMap.get(option.id as string);
                        return (
                            <span className="flex flex-row gap-2">
                                {tool && (
                                    <span className="flex size-[20px] shrink-0">
                                        <IconForConfigType type={tool.configType} />
                                    </span>
                                )}
                                {option.label}
                            </span>
                        );
                    }}
                    renderBadge={(option) => {
                        const tool = toolMap.get(option.id as string);
                        return (
                            <span className="flex flex-row gap-2 items-center justify-center">
                                {tool && (
                                    <span className="flex size-[20px] shrink-0">
                                        <IconForConfigType type={tool.configType} />
                                    </span>
                                )}
                                {option.label}
                            </span>
                        );
                    }}
                />
            </div>
        );
    };

    return <ApprovalSettingsCard>{renderBody()}</ApprovalSettingsCard>;
}

export default AgentApprovalSettings;
