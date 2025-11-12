import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { useAutomationContext } from "../../../context/AutomationContext";
import { InputsSection } from "../InputSection";
import { OutputSection } from "../OutputSection";
import { AutomationUpdate } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultAutomationName } from "@/utility/AutomationUtils";
import { isInputComplete, isOutputComplete } from "@/utility/IntegrationUtils";
import { Conn, SVGFlowArrows } from "../components/FlowArrow";
import { PromptSection } from "../PromptSection";
import { useAutomationMutations } from "@/hooks/api/useAutomations";

function SaveAutomationButton({ defaultName }: { defaultName: string | null }) {
    const navigate = useNavigate();
    const { automationId, name, inputs, output, prompt, isActive, loadAutomation } = useAutomationContext();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const { createAutomation, updateAutomation } = useAutomationMutations();

    // Validation: all required fields must be present
    // Each integration reports its own completeness
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => isInputComplete(i)) &&
        !!output && isOutputComplete(output) &&
        !!prompt?.text; // Ensure prompt is not empty

    const isEditMode = !!automationId;

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !output) return;

        setIsSaving(true);
        try {
            // Debug: Log inputs before mapping
            console.log('Inputs before mapping:', inputs);
            
            const automationData: AutomationUpdate = {
                name: name || defaultName || '',
                inputs: inputs.map(i => {
                    const inputData: any = {
                        integration: i.integration,
                        integrationId: i.integrationId,
                    };
                    
                    // Only include configs if they exist and have required fields
                    if (i.notionConfig) {
                        inputData.notionConfig = i.notionConfig;
                    }
                    if (i.slackConfig) {
                        inputData.slackConfig = i.slackConfig;
                    }
                    if (i.figmaConfig) {
                        // Validate that figmaConfig has both fileKey and teamId before including it
                        if (i.figmaConfig.fileKey && i.figmaConfig.teamId) {
                            inputData.figmaConfig = i.figmaConfig;
                        } else {
                            console.warn('Figma config missing fileKey or teamId, skipping:', i.figmaConfig);
                        }
                    }
                    
                    return inputData;
                }),
                output: {
                    integration: output.integration,
                    integrationId: output.integrationId,
                    ...(output.notionConfig && { notionConfig: output.notionConfig }),
                    ...(output.slackConfig && { slackConfig: output.slackConfig }),
                    ...(output.notionPageConfig && { notionPageConfig: output.notionPageConfig }),
                    ...(output.confluenceConfig && { confluenceConfig: output.confluenceConfig })
                },
                prompt,
                isActive
            };

            if (isEditMode) {
                // Update existing automation
                await updateAutomation({
                    id: automationId!,
                    data: automationData,
                });
            } else {
                // Create new automation
                const creation = await createAutomation({
                    name: automationData.name || '',
                    inputs: automationData.inputs || [],
                    output: automationData.output || { integration: '', integrationId: undefined },
                    prompt: automationData.prompt || { text: '' },
                    isActive: automationData.isActive,
                });

                if (creation?.id) {
                    await loadAutomation(creation.id);
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


export default function AutomationSetupTab() {
    const { name, setName, inputs, output, prompt } = useAutomationContext();
    const [defaultName, setDefaultName] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputsSectionRef = useRef<Map<string, HTMLDivElement>>(new Map());
    const PromptSectionRef = useRef<HTMLDivElement>(null);
    const OutputSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function getDefaultName() {
            const name = await getDefaultAutomationName(inputs, output);
            setDefaultName(name);
        }
        getDefaultName();
    }, [inputs, output]);

    const createMapElementRef = (mapRef: React.RefObject<Map<string, HTMLDivElement>>, inputId: string): React.RefObject<HTMLDivElement | null> => {
        return {
            get current() {
                return mapRef.current?.get(inputId) || null;
            }
        } as React.RefObject<HTMLDivElement | null>;
    };

    const connections: Conn[] = []
    
    if (inputs.length > 0 && inputsSectionRef.current != null && inputsSectionRef.current.size > 0) {
        inputs.forEach((input) => {
            if (input.integration != null && input.integrationId != null) {
                const inputId = input.id || input.integrationId || '';
                const inputCardRef = createMapElementRef(inputsSectionRef, inputId);
                connections.push({ 
                    id: `input-to-prompt-${input.integration}-${input.integrationId}`, 
                    from: inputCardRef, 
                    to: PromptSectionRef 
                });
            }
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
                <SaveAutomationButton defaultName={defaultName} />
            </div>

            <div ref={containerRef} className="grid grid-flow-col place-items-center gap-3 relative">
                <InputsSection ref={inputsSectionRef} />

                <PromptSection ref={PromptSectionRef} />

                <OutputSection ref={OutputSectionRef} />

                {connections.length > 0 && (
                    <SVGFlowArrows containerRef={containerRef} connections={connections} />
                )}
            </div>
        </div>
    )
}


