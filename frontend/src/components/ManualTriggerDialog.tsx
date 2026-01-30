import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { PlayIcon, Loader2Icon } from "lucide-react";
import { BackendProvider } from "@/services/backend";
import { AgentSaveState } from "./IntegrationSelector/types";

interface ManualTriggerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    inputId: string;
    onTriggered?: () => void;
    agentSaveState?: AgentSaveState;
}

export function ManualTriggerDialog({
    isOpen,
    onClose,
    inputId,
    onTriggered,
    agentSaveState,
}: ManualTriggerDialogProps) {
    const [context, setContext] = useState("");
    const [isTriggering, setIsTriggering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTrigger = async () => {
        setIsTriggering(true);
        setError(null);

        try {
            // If there are unsaved changes, save the agent first
            if (agentSaveState?.hasUnsavedChanges) {
                const saveSuccess = await agentSaveState.saveAgent();
                if (!saveSuccess) {
                    setError("Failed to save agent. Please save the agent manually and try again.");
                    return;
                }
            }

            await BackendProvider.triggerManually(
                inputId,
                context.trim() || undefined
            );
            onTriggered?.();
            handleClose();
        } catch (err) {
            setError("Failed to trigger. Please try again.");
            console.error("Manual trigger failed:", err);
        } finally {
            setIsTriggering(false);
        }
    };

    const handleClose = () => {
        setContext("");
        setError(null);
        onClose();
    };

    const hasUnsavedChanges = agentSaveState?.hasUnsavedChanges ?? false;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Manual Trigger</DialogTitle>
                    <DialogDescription>
                        Run this automation now instead of waiting for the next scheduled time.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {hasUnsavedChanges && (
                        <div className="text-sm text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded-md">
                            You have unsaved changes. Triggering will save your agent first.
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="context">
                            Context <span className="text-muted-foreground text-xs">(optional)</span>
                        </Label>
                        <Textarea
                            id="context"
                            placeholder="Why are you triggering this now? Any specific situation or context the automation should know about..."
                            value={context}
                            onChange={(e) => setContext(e.target.value)}
                            className="min-h-[80px]"
                        />
                        <p className="text-xs text-muted-foreground">
                            Add context about why you're running this manually. This will be passed to the automation.
                        </p>
                    </div>

                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} disabled={isTriggering}>
                        Cancel
                    </Button>
                    <Button onClick={handleTrigger} disabled={isTriggering}>
                        {isTriggering ? (
                            <>
                                <Loader2Icon className="size-4 mr-2 animate-spin" />
                                {hasUnsavedChanges ? "Saving & Triggering..." : "Triggering..."}
                            </>
                        ) : (
                            <>
                                <PlayIcon className="size-4 mr-2" />
                                {hasUnsavedChanges ? "Save & Trigger" : "Trigger Now"}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
