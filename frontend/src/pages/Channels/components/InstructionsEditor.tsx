import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangleIcon, Maximize2Icon, Sparkles } from "lucide-react";
import { ChannelInput, ChannelOutput, ChannelPrompt } from "@/shared/types";
import { PromptBuilderModal } from "../../../components/PromptBuilder/PromptBuilderModal";
import { Switch } from "../../../components/ui/switch";
import { Label } from "../../../components/ui/label";

const instructionsPlaceholder = `Describe what you want the AI to do with incoming events from your sources.

For example:
- "Monitor all new GitHub issues and create Linear tickets for bugs, adding appropriate labels and priority"
- "Watch for Notion database updates and post summaries to Slack with key changes highlighted"
- "Track customer feedback from multiple channels and synthesize weekly reports"

Be specific about:
• What information to extract or focus on
• How to format or structure the output
• Any rules for filtering or prioritizing events
• The tone or style for generated content`;

interface InstructionsEditorProps {
    prompt: ChannelPrompt | undefined;
    setPrompt: (prompt: ChannelPrompt | undefined) => void;
    channelInputs: ChannelInput[];
    channelOutput: ChannelOutput;
}

export function InstructionsEditor({ prompt, setPrompt, channelInputs, channelOutput }: InstructionsEditorProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const [showMarkdown, setShowMarkdown] = useState(false);
    const isEmpty = !prompt?.text || prompt.text.trim() === '';

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <div className="flex flex-row gap-2 items-center justify-between mb-2 shrink-0">
                <div className="flex flex-row gap-2 items-center">
                    <h2 className="text-lg">Instructions</h2>
                    {isEmpty && (
                        <AlertTriangleIcon className="size-4 text-yellow-500" />
                    )}
                </div>
                <div className="flex flex-row gap-2 items-center">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="markdown-toggle"
                            checked={showMarkdown}
                            onCheckedChange={setShowMarkdown}
                            disabled={!prompt?.text || prompt.text.trim() === ''}
                        />
                        <Label htmlFor="markdown-toggle" className="text-sm text-muted-foreground cursor-pointer">
                            Markdown
                        </Label>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPromptBuilder(true)}
                    >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Open Prompt Builder
                    </Button>
                </div>

                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsDialogOpen(true)}
                    title="Expand editor"
                >
                    <Maximize2Icon className="size-4" />
                </Button>
            </div>
            <Textarea
                value={prompt?.text}
                onChange={(e) => setPrompt({ ...prompt, text: e.target.value })}
                className="flex-1 min-h-0 resize-none overflow-auto"
                placeholder={instructionsPlaceholder}
            />

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Instructions
                            {isEmpty && (
                                <AlertTriangleIcon className="size-4 text-yellow-500" />
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={prompt?.text}
                        onChange={(e) => setPrompt({ ...prompt, text: e.target.value })}
                        className="flex-1 min-h-0 resize-none"
                        placeholder={instructionsPlaceholder}
                    />
                </DialogContent>
            </Dialog>
            <PromptBuilderModal
                isOpen={showPromptBuilder}
                onClose={() => setShowPromptBuilder(false)}
                inputs={channelInputs}
                output={channelOutput}
                existingPrompt={prompt?.text}
                onPromptGenerated={(generatedPrompt) => {
                    setPrompt({ ...prompt, text: generatedPrompt });
                }}
            />
        </div>
    );
}

