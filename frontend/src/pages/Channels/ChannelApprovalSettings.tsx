import { useState, useEffect } from "react";
import { BackendProvider } from "../../services/backend";
import ToolApprovalSelector, { AvailableTool } from "../../components/channels/ToolApprovalSelector";
import { Channel } from "@/shared/types";

export type ChannelApprovalSettingsProps = {
    channelId: string | null;
    toolApprovalSettings: Array<{ toolName: string; requiresApproval: boolean }>;
    onChange: (toolApprovalSettings: Array<{ toolName: string; requiresApproval: boolean }>) => void;
};

function ChannelApprovalSettings({ channelId, toolApprovalSettings, onChange }: ChannelApprovalSettingsProps) {
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

    // Load available tools when channelId changes
    useEffect(() => {
        if (!channelId) {
            setAvailableTools([]);
            return;
        }

        setIsLoading(true);
        BackendProvider.getAvailableTools(channelId)
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
    }, [channelId]);

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
