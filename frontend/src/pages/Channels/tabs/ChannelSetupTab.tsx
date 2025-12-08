import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { ChannelUpdate, TransientChannelInput, TransientChannelOutput } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultChannelName, toChannelInput, toChannelOutput } from "@/utility/ChannelUtils";
import { useChannelCount } from "@/hooks/api/useChannelCount";
import { useChannelMutations } from "@/hooks/api/useChannels";
import { type KeyedMutator } from 'swr';
import { Channel, ChannelInput, ChannelOutput, ChannelPrompt } from "@/shared/types";
import { Textarea } from "../../../components/ui/textarea";
import { ConfigTitle } from "../components/ConfigTitle";
import { AddInputModal } from "../components/AddInputModal";
import { ConfigInstance, ConfigType } from "../../../shared/Configs";
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { InputConfigSelectorProps, IntegrationSelector } from "../../../components/IntegrationSelector";
import { AlertTriangleIcon, FileText, PlusIcon, Sparkles, XIcon } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Card, CardContent } from "../../../components/ui/card";
import { AddOutputModal } from "../components/AddOutputModal";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";
import { Badge } from "../../../components/ui/badge";
import { PromptBuilderModal } from "../../../components/PromptBuilder/PromptBuilderModal";
import { Switch } from "../../../components/ui/switch";
import { Label } from "../../../components/ui/label";
import ReactMarkdown from "react-markdown";

export type ChannelSetupTabProps = {
    channelId: string | null;
    name: string | null;
    setName: (name: string) => void;
    inputs: TransientChannelInput[];
    setInputs: (inputs: TransientChannelInput[]) => void;
    output: TransientChannelOutput | undefined;
    setOutput: (output: TransientChannelOutput | undefined) => void;
    prompt: ChannelPrompt | undefined;
    setPrompt: (prompt: ChannelPrompt | undefined) => void;
    isActive: boolean;
    setIsActive: (isActive: boolean) => void;
    isLoading: boolean;
    mutate: KeyedMutator<Channel>;
};

function SaveChannelButton({
    defaultName,
    channelId,
    name,
    inputs,
    output,
    prompt,
    isActive,
    mutate
}: {
    defaultName: string;
    channelId: string | null;
    name: string | null;
    inputs: ChannelInput[];
    output: ChannelOutput | undefined;
    prompt: ChannelPrompt | undefined;
    isActive: boolean;
    mutate: KeyedMutator<Channel>;
}) {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const { createChannel, updateChannel } = useChannelMutations();

    // Validation: all required fields must be present
    // Each integration reports its own completeness
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => i.config != null && i.config.isComplete()) &&
        !!output && output.config.isComplete() &&
        !!prompt?.text; // Ensure prompt is not empty

    const isEditMode = !!channelId;

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !output) return;

        setIsSaving(true);
        try {
            const channelData: ChannelUpdate = {
                name: name || defaultName || '',
                inputs,
                output,
                prompt,
                isActive
            };

            if (isEditMode) {
                // Update existing channel
                await updateChannel({
                    id: channelId!,
                    data: channelData,
                    mutateChannel: mutate,
                });
            } else if (isComplete && channelData.output && channelData.inputs && channelData.inputs.length > 0) {
                // Create new channel
                const creation = await createChannel({
                    name: channelData.name || '',
                    inputs: channelData.inputs || [],
                    output: channelData.output,
                    prompt: channelData.prompt || { text: '' },
                    isActive: channelData.isActive || true,
                });

                if (creation?.id) {
                    navigate(`/app/channels/${creation.id}`, { replace: true });
                }
            }

            toast.success('Channel saved successfully');

            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
            }, 1000);
        } catch (error) {
            console.error('Error saving channel:', error);
            alert('Failed to save channel. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Button
            onClick={handleSave}
            disabled={!isComplete || isSaving}
        >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : isComplete ? (isEditMode ? 'Update Channel' : 'Save Channel') : 'Complete All Steps'}
        </Button>
    )
}

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

export default function ChannelSetupTab({
    channelId,
    name,
    setName,
    inputs,
    output,
    prompt,
    setInputs,
    setOutput,
    setPrompt,
    isActive,
    mutate,
}: ChannelSetupTabProps) {
    const { totalCount } = useChannelCount();
    const defaultName = getDefaultChannelName(totalCount);
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);
    const [showMarkdown, setShowMarkdown] = useState(false);

    const channelInputs = inputs.map(toChannelInput).filter((i): i is ChannelInput => i !== null);
    const channelOutput = toChannelOutput(output)

    return (
        <div className="grid grid-flow-row place-items-center gap-8">
            <div className="flex justify-between items-center w-full p-2">
                <EditableTextField value={name || ''} placeholder={defaultName} onSave={(value) => setName(value)} />
                <SaveChannelButton
                    defaultName={defaultName}
                    channelId={channelId}
                    name={name}
                    inputs={channelInputs}
                    output={channelOutput}
                    prompt={prompt}
                    isActive={isActive}
                    mutate={mutate}
                />
            </div>

            <div className="flex flex-row gap-12 h-full">
                <div className="flex flex-col gap-4 justify-between">
                    <div className="flex flex-row gap-4 min-w-md max-w-md">
                        <InputLayout inputs={inputs} setInputs={setInputs} />
                    </div>

                    <div className="min-w-md max-w-md overflow-hidden">
                        <OutputLayout output={output} setOutput={setOutput} />
                    </div>
                </div>

                <div className="min-w-md max-w-md flex flex-col h-full">
                    <div className="flex flex-row gap-2 items-center justify-between mb-2">
                        <div className="flex flex-row gap-2 items-center">
                            <h2 className="text-lg">Instructions</h2>
                            {(!prompt?.text || prompt.text.trim() === '') && (
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
                    </div>
                    <div className="relative flex-1">
                        {showMarkdown && prompt?.text ? (
                            <div className="flex-1 h-full overflow-auto p-3 border rounded-md bg-background">
                                <div className="prose prose-sm dark:prose-invert max-w-none">
                                    <ReactMarkdown>
                                        {prompt.text}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        ) : (
                            <Textarea 
                                value={prompt?.text || ''} 
                                onChange={(e) => {
                                    setPrompt({ ...prompt, text: e.target.value });
                                }}
                                className="flex-1 h-full" 
                                placeholder={instructionsPlaceholder} 
                            />
                        )}
                    </div>
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
            </div>
        </div >
    )
}

function InputLayout({ inputs, setInputs }: { inputs: TransientChannelInput[], setInputs: (inputs: TransientChannelInput[]) => void }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (config: ConfigType) => {
        const newInputId = uuidv4(); // We need to mint a placeholder ID for the new input so that we can identify it later.
        const newInput: TransientChannelInput = { id: newInputId, config: undefined, configType: config };
        const newInputs: TransientChannelInput[] = [...inputs, newInput];
        setInputs(newInputs);
        setShowAddModal(false);
    };

    const handleRemove = (id: string) => {
        setInputs(inputs.filter(input => input.id !== id));
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-row gap-2 items-center mb-2">
                <h2 className="text-lg">Event Sources</h2>
                {inputs.length === 0 && (
                    <AlertTriangleIcon className="size-4 text-yellow-500" />
                )}
            </div>
            <div className="flex flex-row flex-wrap gap-2 items-stretch">
                {inputs.map((input) => (
                    <Input key={input.id} input={input} inputs={inputs} setInputs={setInputs} handleRemove={handleRemove} />
                ))}
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="h-auto aspect-square">
                    <PlusIcon className={cn("size-4", inputs.length > 0 ? "text-primary" : "text-muted-foreground")} />
                </Button>
                <AddInputModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSelectIntegration={handleSelectPlatform}
                />
            </div>
        </div>
    )
}

function Input({ input, inputs, setInputs, handleRemove }: { input: TransientChannelInput, inputs: TransientChannelInput[], setInputs: (inputs: TransientChannelInput[]) => void, handleRemove: (id: string) => void }) {
    const isPlaceholder = input.config === undefined;
    const needsConfiguration = !input.config || !input.config.isComplete();
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    const selectorProps: InputConfigSelectorProps = {
        input: input,
        setConfig: (config: ConfigInstance) => setInputs(inputs.map(i => i.id === input.id ? { ...i, config, configType: config.configType } : i)),
        variant: "card",
    };

    let cardContent;
    if (isPlaceholder) {
        cardContent = (
            <div className="p-2 border rounded-md cursor-pointer" onClick={() => setShowDetailsDialog(true)}>
                <div className="flex flex-row justify-between items-center">
                    <ConfigTitle configType={input.configType} iconSize="md" />
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(input.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>
                <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500">
                    <IntegrationSelector {...selectorProps} variant="card" />
                </Badge>
            </div>
        );
    } else {
        cardContent = (
            <div className="p-2 border rounded-md cursor-pointer" onClick={() => setShowDetailsDialog(true)}>
                <div className="flex flex-row justify-between pb-2">
                    <ConfigTitle configType={input.configType} iconSize="md" />
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(input.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>
                <Badge variant="outline" className="max-w-40 truncate">
                    <IntegrationSelector {...selectorProps} variant="card" />
                </Badge>
            </div>
        );
    }

    return (
        <>
            {cardContent}

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{needsConfiguration ? "Configure Integration" : "Integration Details"}</DialogTitle>
                    </DialogHeader>
                    <IntegrationSelector {...selectorProps} variant="dialog" />
                </DialogContent>
            </Dialog>
        </>
    )
}

function OutputLayout({ output, setOutput }: { output: TransientChannelOutput | undefined, setOutput: (output: TransientChannelOutput | undefined) => void }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (configType: ConfigType) => {
        // Clear all configs when switching platform (new integration type)
        const newOutput: TransientChannelOutput = {
            id: uuidv4(),
            config: undefined,
            configType: configType,
        };
        setOutput(newOutput);
        setShowAddModal(false);
    };

    const onSelect = (config: ConfigInstance) => {
        setOutput({ id: output?.id || uuidv4(), config: config, configType: config.configType });
    };

    const needsConfiguration = !output || !output.config || !output.config.isComplete();

    let cardContent;
    if (!output) {
        cardContent = (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant="icon">
                            <FileText className="text-destructive" />
                        </EmptyMedia>
                        <EmptyTitle>No output yet</EmptyTitle>
                        <EmptyDescription>
                            No output yet. Add an integration to get started.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button onClick={() => setShowAddModal(true)}>
                            <PlusIcon className="h-4 w-4" />
                            Add Output
                        </Button>
                    </EmptyContent>
                </Empty>
        )
    } else {
        cardContent = (
            <IntegrationSelector input={output} variant="dialog" setConfig={onSelect} />
        );
    }

    let headerContent;
    if (needsConfiguration && output) {
        headerContent = (
            <div className="flex flex-row gap-2">
                <h2 className="text-lg">Output</h2>
                <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500">
                    <AlertTriangleIcon className="size-4 text-yellow-500" />
                    Needs Configuration
                </Badge>
            </div>
        );
    } else {
        headerContent = (
            <h2 className="text-lg">Output</h2>
        );
    }

    return (
        <>
            <div className="flex flex-row justify-between items-center mb-4">
                {headerContent}
                {output && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                        Change output
                    </Button>
                )}
            </div>
            <div className="flex flex-row gap-2">
                <Card className="flex flex-row gap-2 w-full min-w-0 overflow-hidden">
                    <CardContent className="min-w-0 overflow-hidden">
                        {cardContent}
                    </CardContent>
                </Card>
            </div>

            <AddOutputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </>
    )
}
