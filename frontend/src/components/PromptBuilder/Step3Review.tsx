import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Step3ReviewProps } from "./types";

export function Step3Review({
    generatedPrompt,
    onRestart,
    onDone
}: Step3ReviewProps) {
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generatedPrompt);
            toast.success('Prompt copied to clipboard!');
        } catch (err) {
            toast.error('Failed to copy prompt');
        }
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold mb-4">Review your prompt</h3>
                <div className="space-y-2">
                    <Textarea
                        value={generatedPrompt}
                        readOnly
                        className="min-h-[300px] font-mono text-sm"
                    />
                    <div className="flex justify-end">
                        <Button variant="outline" onClick={handleCopy} size="sm">
                            <Copy className="h-4 w-4 mr-2" />
                            Copy
                        </Button>
                    </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    Click "Done" to use this prompt in the Instructions field.
                </p>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onRestart}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Restart
                </Button>
                <Button onClick={onDone}>
                    Done
                </Button>
            </div>
        </div>
    );
}

