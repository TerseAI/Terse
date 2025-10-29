import { Button } from "@headlessui/react";
import { ArrowLeftIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TextareaAutosize from 'react-textarea-autosize';
import EditableTextField from '../../components/ui/EditableTextField';
import { AutomationProvider, useAutomationContext } from "../../context/AutomationContext";
import { BackendProvider } from "../../services/backend";
import { InputsSection } from "./InputSection";
import { OutputSection } from "./OutputSection";

function Automations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Only pass automationId if it's not "new"
    const automationId = id && id !== 'new' ? id : undefined;

    return (
        <AutomationProvider automationId={automationId}>
            <div className="flex flex-col h-full">
                <div className="border-b border-[theme(border)] px-6 py-3">
                    <button
                        onClick={() => navigate('/app/automations')}
                        className="inline-flex items-center gap-2 text-sm text-[theme(text-secondary)] hover:text-[theme(text-primary)] transition-colors"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to Automations
                    </button>
                </div>
                <CreateAutomationSection />
            </div>
        </AutomationProvider>
    )
}

function CreateAutomationSection() {
    const { name, setName } = useAutomationContext();
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-6 space-y-4">

                    <div className="space-y-2">
                        <EditableTextField value={name} onSave={(value) => setName(value)} />
                        <p className="text-xs text-[theme(text-secondary)]">
                            Create an automation that listens to events and continuously updates a living document
                        </p>
                    </div>

                    <div className="space-y-3">
                        <InputsSection />

                        <FlowArrow />

                        <PromptSection />

                        <FlowArrow />

                        <OutputSection />
                    </div>
                </div>
            </div>

            <div className="border-t border-[theme(border)] bg-[theme(background)] px-6 py-4">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="text-xs text-[theme(text-secondary)]">
                        <span className="font-medium text-[theme(text-primary)]">Pro tip:</span> Automations run continuously in the background
                    </div>
                    <SaveAutomationButton />
                </div>
            </div>
        </div>
    )
}

function PromptSection() {
    const { prompt, setPrompt } = useAutomationContext();
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[theme(background-elevated)]">
                    <SparklesIcon className="w-5 h-5 text-[theme(--color-accent-secondary)]" />
                </div>
                <div className="flex flex-col">
                    <h2 className="text-base font-semibold text-[theme(text-primary)]">Process With AI</h2>
                    <p className="text-xs text-[theme(text-secondary)] mt-0.5">Describe what you want the AI to do with the incoming events</p>
                </div>
            </div>
            <TextareaAutosize
                value={prompt?.text || ''}
                onChange={(e) => setPrompt({ text: e.target.value })}
                placeholder='e.g., "Summarize all commits and update the changelog", "Create a weekly progress report", etc.'
                minRows={3}
                maxRows={20}
                className="w-full bg-[theme(background-elevated)] rounded-lg p-4 border border-[theme(border)] text-[theme(text-primary)] placeholder:text-[theme(text-secondary)] focus:outline-none focus:border-[theme(--color-accent)] focus:ring-1 focus:ring-[theme(--color-accent)] transition-all duration-200 resize-none overflow-hidden"
            />
        </div>
    )
}

function FlowArrow() {
    return (
        <div className="flex justify-center relative -mb-6">
            <svg width="40" height="64" viewBox="0 0 40 64" className="overflow-visible">
                {/* Main arrow path */}
                <defs>
                    <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.8" />
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
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.8"
                />

                {/* Animated particles */}
                <circle r="1.5" fill="var(--color-accent)" opacity="0.8">
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

                <circle r="1.5" fill="var(--color-accent)" opacity="0.8">
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

                <circle r="1.5" fill="var(--color-accent)" opacity="0.8">
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

                <circle r="1.5" fill="var(--color-accent)" opacity="0.8">
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
    )
}

function SaveAutomationButton() {
    const { automationId, name, inputs, output, prompt, isActive } = useAutomationContext();
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => !!i.integration && !!i.integrationId) &&
        !!output && !!output.integration && !!output.integrationId &&
        !!prompt?.text;
    console.log("isComplete", isComplete);
    console.log("inputs", inputs);
    console.log("output", output);
    console.log("prompt", prompt);  
    const isEditMode = !!automationId;

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !output) return;

        setIsSaving(true);
        try {
            const automationData = {
                name,
                inputs: inputs.map(i => ({ integration: i.integration, integrationId: i.integrationId })),
                output: { integration: output.integration, integrationId: output.integrationId },
                prompt,
                isActive
            };

            if (isEditMode) {
                // Update existing automation
                await BackendProvider.updateAutomation(automationId, automationData);
            } else {
                // Create new automation
                await BackendProvider.createAutomation(
                    automationData.name,
                    automationData.inputs,
                    automationData.output,
                    automationData.prompt,
                    automationData.isActive
                );
            }

            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
                // Navigate back to list after successful save
                navigate('/app/automations');
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
            className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${isComplete && !isSaving
                ? 'bg-[var(--color-accent)] text-[theme(text-primary)] hover:scale-[1.02] hover:brightness-110 shadow-lg'
                : 'bg-[theme(background-surface)] text-[theme(text-disabled)] cursor-not-allowed'
                }`}
            style={isComplete && !isSaving ? {
                boxShadow: '0 0 20px -8px var(--color-accent)'
            } : undefined}
        >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : isComplete ? (isEditMode ? 'Update Automation' : 'Save Automation') : 'Complete All Steps'}
        </Button>
    )
}

export default Automations;