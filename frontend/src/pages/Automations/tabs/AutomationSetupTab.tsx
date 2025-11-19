import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { InputsSection } from "../InputSection";
import { OutputSection } from "../OutputSection";
import { AutomationUpdate, TransientAutomationInput, TransientAutomationOutput } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultAutomationName } from "@/utility/AutomationUtils";
import { useAutomationCount } from "@/hooks/api/useAutomationCount";
import { Conn, SVGFlowArrows } from "../components/FlowArrow";
import { PromptSection } from "../PromptSection";
import { useAutomationMutations } from "@/hooks/api/useAutomations";
import { type KeyedMutator } from 'swr';
import { Automation, AutomationInput, AutomationOutput, AutomationPrompt } from "@/shared/types";

type AutomationSetupTabProps = {
    automationId: string | null;
    name: string | null;
    setName: (name: string) => void;
    inputs: TransientAutomationInput[];
    setInputs: (inputs: TransientAutomationInput[]) => void;
    output: TransientAutomationOutput | undefined;
    setOutput: (output: TransientAutomationOutput | undefined) => void;
    prompt: AutomationPrompt | undefined;
    setPrompt: (prompt: AutomationPrompt | undefined) => void;
    isActive: boolean;
    setIsActive: (isActive: boolean) => void;
    isLoading: boolean;
    mutate: KeyedMutator<Automation>;
};

function SaveAutomationButton({ 
    defaultName, 
    automationId, 
    name, 
    inputs, 
    output, 
    prompt, 
    isActive,
    mutate 
}: { 
    defaultName: string;
    automationId: string | null;
    name: string | null;
    inputs: AutomationInput[];
    output: AutomationOutput | undefined;
    prompt: AutomationPrompt | undefined;
    isActive: boolean;
    mutate: KeyedMutator<Automation>;
}) {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const { createAutomation, updateAutomation } = useAutomationMutations();

    // Validation: all required fields must be present
    // Each integration reports its own completeness
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => i.config != null && i.config.isComplete()) &&
        !!output && output.config.isComplete() &&
        !!prompt?.text; // Ensure prompt is not empty

    const isEditMode = !!automationId;

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !output) return;

        setIsSaving(true);
        try {    
            const automationData: AutomationUpdate = {
                name: name || defaultName || '',
                inputs,
                output,
                prompt,
                isActive
            };

            if (isEditMode) {
                // Update existing automation
                await updateAutomation({
                    id: automationId!,
                    data: automationData,
                    mutateAutomation: mutate,
                });
            } else if (isComplete && automationData.output && automationData.inputs && automationData.inputs.length > 0) {
                // Create new automation
                const creation = await createAutomation({
                    name: automationData.name || '',
                    inputs: automationData.inputs || [],
                    output: automationData.output,
                    prompt: automationData.prompt || { text: '' },
                    isActive: automationData.isActive || true,
                });

                if (creation?.id) {
                    navigate(`/app/automations/${creation.id}`, { replace: true });
                }
            }

            toast.success('Automation saved successfully');

            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
            }, 1000);
        } catch (error) {
            console.error('Error saving automation:', error);
            alert('Failed to save automation. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Button
            onClick={handleSave}
            disabled={!isComplete || isSaving}
        >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : isComplete ? (isEditMode ? 'Update Automation' : 'Save Automation') : 'Complete All Steps'}
        </Button>
    )
}


export default function AutomationSetupTab({
    automationId,
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
}: AutomationSetupTabProps) {
    const { totalCount } = useAutomationCount();
    const defaultName = getDefaultAutomationName(totalCount);

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

    const automationInputs = inputs.map(convertTransientAutomationInputToAutomationInput).filter(i => i != null) as AutomationInput[];
    const automationOutput = convertTransientAutomationOutputToAutomationOutput(output)
    
    if (automationInputs.length > 0 && inputsSectionRef.current != null && inputsSectionRef.current.size > 0) {
        automationInputs.forEach((input) => {
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
                    <SaveAutomationButton 
                        defaultName={defaultName}
                        automationId={automationId}
                        name={name}
                        inputs={automationInputs}
                        output={automationOutput}
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

function convertTransientAutomationInputToAutomationInput(input: TransientAutomationInput): AutomationInput | null {
    if (input.config == null) {
        return null
    }
    return {
        id: input.id,
        config: input.config,
    };
}

function convertTransientAutomationOutputToAutomationOutput(output?: TransientAutomationOutput): AutomationOutput | undefined {
    if (output == null || output.config == null) {
        return undefined
    }
    return {
        id: output.id,
        config: output.config,
    };
}