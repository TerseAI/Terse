import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { OutputCard, OutputSection } from "../OutputSection";
import { ChannelUpdate, TransientChannelInput, TransientChannelOutput } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultChannelName, toChannelInput, toChannelOutput } from "@/utility/ChannelUtils";
import { useChannelCount } from "@/hooks/api/useChannelCount";
import { Conn, SVGFlowArrows } from "../components/FlowArrow";
import { PromptSection } from "../PromptSection";
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
import { CrossIcon, PlusIcon, XIcon } from "lucide-react";
import { cn } from "../../../lib/utils";

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


// function ChannelSetupTabOLD({
//     channelId,
//     name,
//     setName,
//     inputs,
//     output,
//     prompt,
//     setInputs,
//     setOutput,
//     setPrompt,
//     isActive,
//     isLoading,
//     mutate,
// }: ChannelSetupTabProps) {
//     const { totalCount } = useChannelCount();
//     const defaultName = getDefaultChannelName(totalCount);

//     const containerRef = useRef<HTMLDivElement>(null);
//     const inputsSectionRef = useRef<Map<string, HTMLDivElement>>(new Map());
//     const PromptSectionRef = useRef<HTMLDivElement>(null);
//     const OutputSectionRef = useRef<HTMLDivElement>(null);

//     const createMapElementRef = (mapRef: React.RefObject<Map<string, HTMLDivElement>>, inputId: string): React.RefObject<HTMLDivElement | null> => {
//         return {
//             get current() {
//                 return mapRef.current?.get(inputId) || null;
//             }
//         } as React.RefObject<HTMLDivElement | null>;
//     };

//     const connections: Conn[] = []

//     const channelInputs = inputs.map(toChannelInput).filter((i): i is ChannelInput => i !== null);
//     const channelOutput = toChannelOutput(output)


//     if (channelInputs.length > 0 && inputsSectionRef.current != null && inputsSectionRef.current.size > 0) {
//         channelInputs.forEach((input) => {
//             const inputCardRef = createMapElementRef(inputsSectionRef, input.id);
//             connections.push({
//                 id: `input-to-prompt-${input.config.integrationType}-${input.config.integrationId}`,
//                 from: inputCardRef,
//                 to: PromptSectionRef
//             });
//         });
//     }
//     if (prompt != null && PromptSectionRef.current != null && OutputSectionRef.current != null && output != null) {
//         connections.push({ id: 'prompt-to-output', from: PromptSectionRef, to: OutputSectionRef });
//     }

//     return (
//         <div className="flex flex-col h-full p-4 overflow-y-auto gap-6">

//             <div className="flex justify-between items-center mb-10">
//                 <div className="flex items-center gap-2">
//                     <EditableTextField value={name || defaultName || ''} onSave={(value) => setName(value)} />
//                 </div>
//                 <SaveChannelButton
//                     defaultName={defaultName}
//                     channelId={channelId}
//                     name={name}
//                     inputs={channelInputs}
//                     output={channelOutput}
//                     prompt={prompt}
//                     isActive={isActive}
//                     mutate={mutate}
//                 />
//             </div>

//             <div ref={containerRef} className="grid grid-flow-col place-items-center gap-3 relative">
//                 <InputsSection ref={inputsSectionRef} inputs={inputs} setInputs={setInputs} isLoading={isLoading} />

//                 <PromptSection ref={PromptSectionRef} prompt={prompt} setPrompt={setPrompt} />

//                 <OutputSection ref={OutputSectionRef} output={output} setOutput={setOutput} isLoading={isLoading} />

//                 {connections.length > 0 && (
//                     <SVGFlowArrows containerRef={containerRef} connections={connections} />
//                 )}
//             </div>
//         </div>
//     )
// }

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
    isLoading,
    mutate,
}: ChannelSetupTabProps) {
    const { totalCount } = useChannelCount();
    const defaultName = getDefaultChannelName(totalCount);

    const channelInputs = inputs.map(toChannelInput).filter((i): i is ChannelInput => i !== null);
    const channelOutput = toChannelOutput(output)

    return (
        <div className="grid grid-flow-row place-items-center gap-4">
            <div className="flex justify-between items-center w-full">
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
            <h1>{name}</h1>

            <div className="flex flex-row gap-4">
                <InputLayout inputs={inputs} setInputs={setInputs} />
            </div>

            <div className="min-w-100">
                <Textarea value={prompt?.text} onChange={(e) => setPrompt({ ...prompt, text: e.target.value })} className="min-h-100" />
            </div>

            {/* <div>
                {output && (
                    <OutputCard output={output} handleRemove={() => setOutput(undefined)} setOutput={(output) => setOutput(output)} />
                )}
            </div> */}
        </div>
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
        <div className="flex flex-row gap-2 items-center">
            {inputs.map((input) => (
                <Input key={input.id} input={input} inputs={inputs} setInputs={setInputs} handleRemove={handleRemove} />
            ))}
            <Button variant="outline" onClick={() => setShowAddModal(true)}>
                <PlusIcon className={cn("size-4", inputs.length > 0 ? "text-primary" : "text-muted-foreground")} />
            </Button>
            <AddInputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
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
    
    return (
        <>
            <div className="flex flex-row justify-between items-center gap-1 p-2 border rounded-md cursor-pointer" onClick={() => setShowDetailsDialog(true)}>
                <ConfigTitle configType={input.configType} iconSize="md" />
                <Button variant="ghost" size="icon-sm" onClick={() => handleRemove(input.id)} className="hover:text-destructive">
                    <XIcon />
                </Button>
            </div>

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