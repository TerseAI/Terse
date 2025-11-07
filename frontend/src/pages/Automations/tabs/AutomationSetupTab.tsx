import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import EditableTextField from '../../../components/ui/EditableTextField';
import { useAutomationContext } from "../../../context/AutomationContext";
import { BackendProvider } from "../../../services/backend";
import { InputsSection } from "../InputSection";
import { OutputSection } from "../OutputSection";
import { AutomationUpdate } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultAutomationName } from "@/utility/AutomationUtils";
import { Conn, SVGFlowArrows } from "../components/FlowArrow";
import { PromptSection } from "../PromptSection";

function SaveAutomationButton({ defaultName }: { defaultName: string | null }) {
    const { automationId, name, inputs, output, prompt, isActive } = useAutomationContext();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

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
                        console.log('Figma config found:', i.figmaConfig);
                        // Validate that figmaConfig has both fileKey and teamId before including it
                        if (i.figmaConfig.fileKey && i.figmaConfig.teamId) {
                            inputData.figmaConfig = i.figmaConfig;
                            console.log('Including figmaConfig with fileKey and teamId:', i.figmaConfig);
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
                    ...(output.notionPageConfig && { notionPageConfig: output.notionPageConfig })
                },
                prompt,
                isActive
            };

            toast.success('Automation saved successfully');
            if (isEditMode) {
                // Update existing automation
                await BackendProvider.updateAutomation(automationId, automationData);
            } else {
                // Create new automation
                await BackendProvider.createAutomation(
                    automationData.name || '',
                    automationData.inputs || [],
                    automationData.output || { integration: '', integrationId: undefined },
                    automationData.prompt || { text: '' },
                    automationData.isActive
                );
            }

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
    const { name, setName, inputs, output } = useAutomationContext();
    const [defaultName, setDefaultName] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const InputsSectionRef = useRef<HTMLDivElement>(null);
    const PromptSectionRef = useRef<HTMLDivElement>(null);
    const OutputSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function getDefaultName() {
            const name = await getDefaultAutomationName(inputs, output);
            setDefaultName(name);
        }
        getDefaultName();
    }, [inputs, output]);

    const connections: Conn[] = []
    
    if (inputs.length > 0 && InputsSectionRef.current != null) {
        for (const input of inputs) {
            if (input.integration != null && input.integrationId != null) {
                connections.push({ id: `input-to-prompt-${input.integration}-${input.integrationId}`, from: InputsSectionRef, to: PromptSectionRef });
            }
        }
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

            <div ref={containerRef} className="grid grid-flow-col place-items-start gap-3 relative">
                <InputsSection ref={InputsSectionRef} />

                <PromptSection ref={PromptSectionRef} />

                <OutputSection ref={OutputSectionRef} />

                {
                    connections.length > 0 && (
                        <SVGFlowArrows containerRef={containerRef} connections={connections} />
                    )
                }
            </div>
        </div>
    )
}


