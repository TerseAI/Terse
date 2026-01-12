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

interface ManualTriggerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    inputId: string;
    onTriggered?: () => void;
}

export function ManualTriggerDialog({
    isOpen,
    onClose,
    inputId,
    onTriggered,
}: ManualTriggerDialogProps) {
    const [context, setContext] = useState("");
    const [isTriggering, setIsTriggering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTrigger = async () => {
        setIsTriggering(true);
        setError(null);

        try {
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
                                Triggering...
                            </>
                        ) : (
                            <>
                                <PlayIcon className="size-4 mr-2" />
                                Trigger Now
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
