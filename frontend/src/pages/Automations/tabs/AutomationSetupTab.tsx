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
import { SVGFlowArrows } from "../components/FlowArrow";
import { PromptSection } from "../PromptSection";

function SaveAutomationButton({ defaultName }: { defaultName: string | null }) {
    const { automationId, name, inputs, output, prompt, isActive } = useAutomationContext();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Validation: all required fields must be present
    // Note: Config (notionConfig, slackConfig) is optional - defaults are used if not provided
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => !!i.integration && !!i.integrationId) &&
        !!output && !!output.integration && !!output.integrationId &&
        !!prompt?.text; // Ensure name is not empty

    const isEditMode = !!automationId;

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !output) return;

        setIsSaving(true);
        try {
            const automationData: AutomationUpdate = {
                name: name || defaultName || '',
                inputs: inputs.map(i => ({
                    integration: i.integration,
                    integrationId: i.integrationId,
                    ...(i.notionConfig && { notionConfig: i.notionConfig }),
                    ...(i.slackConfig && { slackConfig: i.slackConfig })
                })),
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

    console.log('containerRef', containerRef.current);
    console.log('InputsSectionRef', InputsSectionRef.current);
    console.log('PromptSectionRef', PromptSectionRef.current);
    console.log('OutputSectionRef', OutputSectionRef.current);

    return (
        <div className="flex flex-col h-full p-4 overflow-y-auto gap-6">

            <div className="flex justify-between items-center">
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
                    containerRef.current && InputsSectionRef.current && PromptSectionRef.current && OutputSectionRef.current && (
                        <SVGFlowArrows containerRef={containerRef} connections={[
                            { id: 'input-to-prompt', from: InputsSectionRef, to: PromptSectionRef },
                            { id: 'prompt-to-output', from: PromptSectionRef, to: OutputSectionRef },
                        ]} />
                    )
                }
            </div>
        </div>
    )
}


