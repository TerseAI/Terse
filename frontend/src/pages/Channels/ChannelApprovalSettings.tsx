import { useState, useEffect, useMemo } from "react";
import { BackendProvider } from "../../services/backend";
import ToolApprovalSelector, { AvailableTool } from "../../components/Channels/ToolApprovalSelector";
import { TransientChannelOutput } from "@/shared/types";

export type ChannelApprovalSettingsProps = {
    outputs: TransientChannelOutput[];
    toolApprovalSettings: Array<{ toolName: string; requiresApproval: boolean }>;
    onChange: (toolApprovalSettings: Array<{ toolName: string; requiresApproval: boolean }>) => void;
};

function ChannelApprovalSettings({ outputs, toolApprovalSettings, onChange }: ChannelApprovalSettingsProps) {
    const [availableTools, setAvailableTools] = useState<AvailableTool[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());

    // Initialize selected tools from props
    useEffect(() => {
        const selected = new Set<string>();
        toolApprovalSettings.forEach(setting => {
            if (setting.requiresApproval) {
                selected.add(setting.toolName);
            }
        });
        setSelectedTools(selected);
    }, [toolApprovalSettings]);

    // Derive integration types from configured outputs (only complete ones)
    const integrationTypes = useMemo(() => {
        return outputs
            .filter(output => output.config?.isComplete?.())
            .map(output => output.config!.integrationType)
            .filter((type, index, self) => self.indexOf(type) === index); // Remove duplicates
    }, [outputs]);

    // Load available tools when integration types change
    useEffect(() => {
        if (integrationTypes.length === 0) {
            setAvailableTools([]);
            return;
        }

        setIsLoading(true);
        BackendProvider.getAvailableToolsForOutputs(integrationTypes)
            .then(tools => {
                setAvailableTools(tools);
            })
            .catch(error => {
                console.error('Error loading available tools:', error);
                setAvailableTools([]);
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [integrationTypes]);

    const handleToolToggle = (toolName: string, requiresApproval: boolean) => {
        const newSelected = new Set(selectedTools);
        if (requiresApproval) {
            newSelected.add(toolName);
        } else {
            newSelected.delete(toolName);
        }
        setSelectedTools(newSelected);

        // Update parent with new settings
        const newSettings = Array.from(newSelected).map(name => ({
            toolName: name,
            requiresApproval: true,
        }));
        onChange(newSettings);
    };

    return (
        <ToolApprovalSelector
            tools={availableTools}
            selectedTools={selectedTools}
            onChange={handleToolToggle}
            isLoading={isLoading}
        />
    );
}

export default ChannelApprovalSettings;
