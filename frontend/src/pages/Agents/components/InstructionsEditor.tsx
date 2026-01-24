import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2Icon, Sparkles, Info, AlertTriangleIcon } from "lucide-react";
import { AgentTrigger, AgentOutput, AgentKnowledgeBase, AgentPrompt } from "@/shared/types";
import { PromptBuilderModal } from "../../../components/PromptBuilder/PromptBuilderModal";
import { Switch } from "../../../components/ui/switch";
import { Label } from "../../../components/ui/label";
import ReactMarkdown from "react-markdown";
import { SectionHeader } from "@/components/ui/section-header";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../../components/ui/tooltip";

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
    prompt: AgentPrompt | undefined;
    setPrompt: (prompt: AgentPrompt | undefined) => void;
    agentInputs: AgentTrigger[];
    agentOutputs: AgentOutput[];
    knowledgeBases?: AgentKnowledgeBase[];
    isIncomplete?: boolean;
}

export function InstructionsEditor({ prompt, setPrompt, agentInputs, agentOutputs, knowledgeBases, isIncomplete }: InstructionsEditorProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const [showMarkdown, setShowMarkdown] = useState(false);
    const text: string = prompt?.text ?? '';

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            <div className="flex flex-row gap-2 items-center justify-between mb-4 shrink-0">
                <div className="flex flex-row gap-2 items-center">
                    <SectionHeader>Prompt</SectionHeader>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Info className="size-3 text-muted-foreground hover:text-foreground cursor-help relative -top-1" />
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs whitespace-pre-line">
                            The prompt describes what the AI should do with incoming events. Be specific about what information to extract, how to format output, and any rules for filtering or prioritizing.
                        </TooltipContent>
                    </Tooltip>
                </div>
                <div className="flex justify-end gap-2">
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
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsDialogOpen(true)}
                        title="Expand editor"
                    >
                        <Maximize2Icon className="size-4" />
                    </Button>
                </div>
            </div>
            {showMarkdown && prompt?.text ? (
                <div className="flex-1 min-h-0 overflow-auto p-3 border rounded-md bg-background">
                    <div className="react-markdown prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>
                            {prompt.text}
                        </ReactMarkdown>
                    </div>
                </div>
            ) : (
                <Textarea
                    value={text}
                    onChange={(e) => setPrompt({ ...prompt, text: e.target.value })}
                    className="flex-1 min-h-0 resize-none overflow-auto"
                    placeholder={instructionsPlaceholder}
                />
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Prompt
                        </DialogTitle>
                    </DialogHeader>
                    {showMarkdown && prompt?.text ? (
                        <div className="flex-1 min-h-0 overflow-auto p-3 border rounded-md bg-background">
                            <div className="react-markdown prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>
                                    {prompt.text}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <Textarea
                            value={text}
                            onChange={(e) => setPrompt({ ...prompt, text: e.target.value })}
                            className="flex-1 min-h-0 resize-none"
                            placeholder={instructionsPlaceholder}
                        />
                    )}
                </DialogContent>
            </Dialog>
            <PromptBuilderModal
                isOpen={showPromptBuilder}
                onClose={() => setShowPromptBuilder(false)}
                inputs={agentInputs}
                outputs={agentOutputs}
                knowledgeBases={knowledgeBases}
                existingPrompt={prompt?.text}
                onPromptGenerated={(generatedPrompt) => {
                    setPrompt({ ...prompt, text: generatedPrompt });
                }}
            />
        </div>
    );
}

