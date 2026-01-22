import { Switch } from "../../components/ui/switch";
import { Label } from "../../components/ui/label";

export type AgentApprovalSettingsProps = {
    requireApproval: boolean;
    onChange: (requireApproval: boolean) => void;
};

function AgentApprovalSettings({ requireApproval, onChange }: AgentApprovalSettingsProps) {
    const handleToggleApproval = (checked: boolean) => {
        onChange(checked);
    };

    return (
        <div className="flex flex-col gap-2 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                    <Label htmlFor="require-approval" className="text-base font-medium">
                        Require approval for edit actions
                    </Label>
                    <p className="text-sm text-muted-foreground">
                        When enabled, the bot will pause and request approval before executing write operations (create, update, delete).
                    </p>
                </div>
                <Switch
                    id="require-approval"
                    checked={requireApproval}
                    onCheckedChange={handleToggleApproval}
                />
            </div>
        </div>
    )
}

export default AgentApprovalSettings;

