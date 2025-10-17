import { AutomationProvider, useAutomationContext } from "../../context/AutomationContext";
import { InputsSection } from "./InputSection";
import { OutputSection } from "./OutputSection";
import { SectionLayout } from "./components/SectionLayout";
import GlowingTextField, { Size } from '../../components/GlowingTextField';
import EditableTextField from '../../components/ui/EditableTextField';
import { Button } from "@headlessui/react";
import { SparklesIcon, BoltIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

function Automations() {
    return (
        <AutomationProvider>
            <CreateAutomationSection />
        </AutomationProvider>
    )
}

function CreateAutomationSection() {
    const { name, setName } = useAutomationContext();
    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-6 space-y-4">
                    {/* Header */}
                    <div className="space-y-2">
                        <EditableTextField value={name} onSave={(value) => setName(value)} />
                        <p className="text-xs text-[theme(text-secondary)]">
                            Create an automation that listens to events and continuously updates a living document
                        </p>
                    </div>

                    {/* Automation Flow */}
                    <div className="space-y-3">
                        <InputsSection />

                        {/* Flow Arrow */}
                        <div className="flex justify-center">
                            <svg className="w-4 h-4 text-[theme(text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </div>

                        <PromptSection />

                        {/* Flow Arrow */}
                        <div className="flex justify-center">
                            <svg className="w-4 h-4 text-[theme(text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </div>

                        <OutputSection />
                    </div>
                </div>
            </div>

            {/* Sticky Footer with Save Button */}
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
                    <SparklesIcon className="w-5 h-5 text-[theme(--color-accent)]" />
                </div>
                <div className="flex flex-col">
                    <h2 className="text-base font-semibold text-[theme(text-primary)]">Process With AI</h2>
                    <p className="text-xs text-[theme(text-secondary)] mt-0.5">Describe what you want the AI to do with the incoming events</p>
                </div>
            </div>
            <textarea
                value={prompt?.text || ''}
                onChange={(e) => setPrompt({ text: e.target.value })}
                placeholder='e.g., "Summarize all commits and update the changelog", "Create a weekly progress report", etc.'
                className="w-full min-h-[100px] bg-[theme(background-elevated)] rounded-lg p-4 border border-[theme(border)] text-[theme(text-primary)] placeholder:text-[theme(text-secondary)] focus:outline-none focus:border-[theme(--color-accent)] focus:ring-1 focus:ring-[theme(--color-accent)] transition-all duration-200 resize-none"
            />
        </div>
    )
}

function SaveAutomationButton() {
    const { inputs, output, prompt } = useAutomationContext();
    const isComplete = inputs.length > 0 && output && prompt?.text;

    return (
        <Button
            disabled={!isComplete}
            className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
                isComplete
                    ? 'bg-[var(--color-accent)] text-[theme(text-primary)] hover:scale-[1.02] hover:brightness-110 shadow-lg'
                    : 'bg-[theme(background-surface)] text-[theme(text-disabled)] cursor-not-allowed'
            }`}
            style={isComplete ? {
                boxShadow: '0 0 20px -8px var(--color-accent)'
            } : undefined}
        >
            {isComplete ? 'Create Automation' : 'Complete All Steps'}
        </Button>
    )
}

export default Automations;