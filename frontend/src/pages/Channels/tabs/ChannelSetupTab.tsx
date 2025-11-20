import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { InputsSection } from "../InputSection";
import { OutputSection } from "../OutputSection";
import { ChannelUpdate, TransientChannelInput, TransientChannelOutput } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultChannelName, toChannelInput, toChannelOutput } from "@/utility/ChannelUtils";
import { useChannelCount } from "@/hooks/api/useChannelCount";
import { Conn, SVGFlowArrows } from "../components/FlowArrow";
import { PromptSection } from "../PromptSection";
import { useChannelMutations } from "@/hooks/api/useChannels";
import { type KeyedMutator } from 'swr';
import { Channel, ChannelInput, ChannelOutput, ChannelPrompt } from "@/shared/types";

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
    isLoading,
    mutate,
}: ChannelSetupTabProps) {
    const { totalCount } = useChannelCount();
    const defaultName = getDefaultChannelName(totalCount);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputsSectionRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const PromptSectionRef = useRef<HTMLDivElement>(null);
    const OutputSectionRef = useRef<HTMLDivElement>(null);

    const createMapElementRef = (mapRef: React.RefObject<Map<string, HTMLDivElement>>, inputId: string): React.RefObject<HTMLDivElement | null> => {
        return {
            get current() {
                return mapRef.current?.get(inputId) || null;
            }
        } as React.RefObject<HTMLDivElement | null>;
    };

    const connections: Conn[] = []

    const channelInputs = inputs.map(toChannelInput).filter((i): i is ChannelInput => i !== null);
    const channelOutput = toChannelOutput(output)

    
    if (channelInputs.length > 0 && inputsSectionRef.current != null && inputsSectionRef.current.size > 0) {
        channelInputs.forEach((input) => {
            const inputCardRef = createMapElementRef(inputsSectionRef, input.id);
            connections.push({ 
                id: `input-to-prompt-${input.config.integrationType}-${input.config.integrationId}`, 
                from: inputCardRef, 
                to: PromptSectionRef 
            });
        });
    }
    if (prompt != null && PromptSectionRef.current != null && OutputSectionRef.current != null && output != null) {
        connections.push({ id: 'prompt-to-output', from: PromptSectionRef, to: OutputSectionRef });
    }

    return (
        <div className="flex flex-col h-full p-4 overflow-y-auto gap-6">

                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-2">
                        <EditableTextField value={name || defaultName || ''} onSave={(value) => setName(value)} />
                    </div>
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

                <div ref={containerRef} className="grid grid-flow-col place-items-center gap-3 relative">
                    <InputsSection ref={inputsSectionRef} inputs={inputs} setInputs={setInputs} isLoading={isLoading} />

                    <PromptSection ref={PromptSectionRef} prompt={prompt} setPrompt={setPrompt} />

                    <OutputSection ref={OutputSectionRef} output={output} setOutput={setOutput} isLoading={isLoading} />

                {connections.length > 0 && (
                    <SVGFlowArrows containerRef={containerRef} connections={connections} />
                )}
            </div>
        </div>
    )
}
