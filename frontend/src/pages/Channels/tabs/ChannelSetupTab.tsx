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
import { AlertTriangleIcon, FileText, PlusIcon, XIcon } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Card, CardContent } from "../../../components/ui/card";
import { AddOutputModal } from "../components/AddOutputModal";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../../components/ui/empty";

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

    const channelInputs = inputs.map(toChannelInput).filter((i): i is ChannelInput => i !== null);
    const channelOutput = toChannelOutput(output)

    return (
        <div className="grid grid-flow-row place-items-center gap-8">
            <div className="flex justify-between items-center w-full p-2">
                <EditableTextField value={name || defaultName || ''} onSave={(value) => setName(value)} />
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

            <div className="flex flex-row gap-4 min-w-md max-w-md">
                <InputLayout inputs={inputs} setInputs={setInputs} />
            </div>

            <div className="min-w-md max-w-md">
                <h2 className="text-lg mb-2">Instructions</h2>
                <Textarea value={prompt?.text} onChange={(e) => setPrompt({ ...prompt, text: e.target.value })} className="min-h-100" />
            </div>

            <div className="min-w-md max-w-md">
                <OutputLayout output={output} setOutput={setOutput} />
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
            <h2 className="text-lg mb-2">Event Sources</h2>
            <div className="flex flex-row gap-2 items-stretch">
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
        variant: "card"
    };

    let cardContent;
    if (isPlaceholder) {
        cardContent = (
            <div className="flex flex-row justify-between items-center gap-1 p-2 border border-yellow-500 rounded-md cursor-pointer" onClick={() => setShowDetailsDialog(true)}>
                <ConfigTitle configType={input.configType} iconSize="md" />
                <AlertTriangleIcon className="size-4 text-yellow-500" />
            </div>
        );
    } else {
        cardContent = (
            <div className="flex flex-row justify-between items-center gap-1 p-2 border rounded-md cursor-pointer" onClick={() => setShowDetailsDialog(true)}>
                <ConfigTitle configType={input.configType} iconSize="md" />
                <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(input.id); }} className="hover:text-destructive">
                    <XIcon />
                </Button>
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

    let cardContent;
    if (!output) {
        cardContent = (
            <div className="flex flex-col gap-2">
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
            </div>
        )
    } else {
        cardContent = (
            <IntegrationSelector input={output} variant="dialog" setConfig={onSelect} />
        );
    }

    return (
        <>
            <div className="flex flex-row justify-between items-center mb-4">
                <h2 className="text-lg">Output</h2>
                {output && (
                    <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
                        Change output
                    </Button>
                )}
            </div>
            <div className="flex flex-row gap-2 justify-center">
                <Card className="flex flex-row gap-2">
                    <CardContent>
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