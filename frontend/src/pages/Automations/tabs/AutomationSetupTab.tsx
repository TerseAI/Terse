import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import EditableTextField from '../../../components/ui/EditableTextField';
import { Textarea } from "@/components/ui/textarea";
import { useAutomationContext } from "../../../context/AutomationContext";
import { BackendProvider } from "../../../services/backend";
import { InputsSection } from "../InputSection";
import { OutputSection } from "../OutputSection";
import { SectionLayout } from "../components/SectionLayout";
import { MessageCircle } from "lucide-react";
import { AutomationUpdate } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultAutomationName } from "@/utility/AutomationUtils";
import { Integration } from "@/types/Integration";

function PromptSection() {
    const { prompt, setPrompt } = useAutomationContext();
    return (
        <SectionLayout title="Prompt" subtitle="The AI will use this prompt to generate the output" icon={<MessageCircle className="w-5 h-5 text-sidebar-primary" />}>
            <Textarea
                value={prompt?.text || ''}
                onChange={(e) => setPrompt({ text: e.target.value })}
                placeholder='e.g., "Summarize all commits and update the changelog", "Create a weekly progress report", etc.'
                className="w-full bg-[theme(background)] rounded-lg p-4 border border-[theme(border)] text-foreground placeholder:text-[theme(text-secondary)] focus:outline-none focus:border-[theme(border)] focus:ring-1 focus:ring-[theme(ring)] transition-all duration-200 resize-none overflow-hidden"
            />
        </SectionLayout>
    )
}

function FlowArrow() {
    return (
        <SectionLayout title={""}>
            <div className="flex justify-center relative -mb-6">
                <svg width="40" height="64" viewBox="0 0 40 64" className="overflow-visible">
                    {/* Main arrow path */}
                    <defs>
                        <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity="0.8" />
                        </linearGradient>
                    </defs>

                    {/* Arrow line */}
                    <line
                        x1="20"
                        y1="4"
                        x2="20"
                        y2="56"
                        stroke="url(#arrowGradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />

                    {/* Arrow head */}
                    <path
                        d="M 20 56 L 16 52 M 20 56 L 24 52"
                        stroke="var(--color-destructive)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.8"
                    />

                    {/* Animated particles */}
                    <circle r="1.5" fill="var(--color-destructive)" opacity="0.8">
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path="M 20 4 L 20 56"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    </circle>

                    <circle r="1.5" fill="var(--color-destructive)" opacity="0">
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path="M 20 4 L 20 56"
                            begin="0.5s"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="2s"
                            repeatCount="indefinite"
                            begin="0.5s"
                        />
                    </circle>

                    <circle r="1.5" fill="var(--color-destructive)" opacity="0">
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path="M 20 4 L 20 56"
                            begin="1s"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="2s"
                            repeatCount="indefinite"
                            begin="1s"
                        />
                    </circle>

                    <circle r="1.5" fill="var(--color-destructive)" opacity="0">
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path="M 20 4 L 20 56"
                            begin="1.5s"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="2s"
                            repeatCount="indefinite"
                            begin="1.5s"
                        />
                    </circle>
                </svg>
            </div>
        </SectionLayout>
    )
}

function SaveAutomationButton({ defaultName }: { defaultName: string | null }) {
    const { automationId, name, inputs, output, prompt, isActive } = useAutomationContext();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Validation: all required fields must be present
    // Note: Config (notionConfig, slackConfig) is optional - defaults are used if not provided
    // Figma requires fileKey in figmaConfig
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => {
            if (!i.integration || !i.integrationId) return false;
            // For Figma, require fileKey
            if (i.integration === Integration.FIGMA && !i.figmaConfig?.fileKey) {
                return false;
            }
            return true;
        }) &&
        !!output && !!output.integration && !!output.integrationId &&
        !!prompt?.text; // Ensure name is not empty

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
                        // Validate that figmaConfig has fileKey before including it
                        if (i.figmaConfig.fileKey) {
                            inputData.figmaConfig = i.figmaConfig;
                            console.log('Including figmaConfig with fileKey:', i.figmaConfig.fileKey);
                        } else {
                            console.warn('Figma config missing fileKey, skipping:', i.figmaConfig);
                        }
                    } else {
                        console.log('No figmaConfig for input:', i.integration);
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

    useEffect(() => {
        async function getDefaultName() {
            const name = await getDefaultAutomationName(inputs, output);
            setDefaultName(name);
        }
        getDefaultName();
    }, [inputs, output]);

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex-1 overflow-y-auto">

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <EditableTextField value={name || defaultName || ''} onSave={(value) => setName(value)} />
                    </div>
                    <SaveAutomationButton defaultName={defaultName}/>
                </div>

                <div className="flex flex-col gap-3">
                    <InputsSection />

                    <FlowArrow />

                    <PromptSection />

                    <FlowArrow />

                    <OutputSection />
                </div>
            </div>
        </div>
    )
}


