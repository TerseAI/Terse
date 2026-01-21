import ToolApprovalSelector from "../../components/Channels/ToolApprovalSelector";
import { TransientChannelOutput } from "@/shared/types";
import { useAvailableTools } from "@/hooks/api/useAvailableTools";

export type ChannelApprovalSettingsProps = {
    outputs: TransientChannelOutput[];
    toolApprovalSettings: Array<{ toolName: string; requiresApproval: boolean }>;
    onChange: (toolApprovalSettings: Array<{ toolName: string; requiresApproval: boolean }>) => void;
};

function ChannelApprovalSettings({ outputs, toolApprovalSettings, onChange }: ChannelApprovalSettingsProps) {
    // Derive integration types from configured outputs (only complete ones)
    const integrationTypes = outputs
        .filter(output => output.config?.isComplete?.())
        .map(output => output.config!.integrationType)
        .filter((type, index, self) => self.indexOf(type) === index); // Remove duplicates

    // Fetch available tools
    const { availableTools, isLoading } = useAvailableTools(integrationTypes);

    // Compute selected tools from props
    const selectedTools = new Set<string>();
    toolApprovalSettings.forEach(setting => {
        if (setting.requiresApproval) {
            selectedTools.add(setting.toolName);
        }
    });

    const handleToolToggle = (toolName: string, requiresApproval: boolean) => {
        const newSelected = new Set(selectedTools);
        if (requiresApproval) {
            newSelected.add(toolName);
        } else {
            newSelected.delete(toolName);
        }

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
