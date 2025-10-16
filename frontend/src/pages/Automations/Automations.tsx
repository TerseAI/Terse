import { AutomationProvider, useAutomationContext } from "../../context/AutomationContext";
import { InputsSection } from "./InputSection";
import { OutputSection } from "./OutputSection";
import { SectionLayout } from "./components/SectionLayout";
import GlowingTextField, { Size } from '../../components/GlowingTextField';
import EditableTextField from '../../components/ui/EditableTextField';
import { Button } from "@headlessui/react";

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
        <>
            <div className="grid grid-flow-row gap-4 overflow-y-auto min-w-0-auto p-8">
                <div className="-pl-10 mb-10">
                    <EditableTextField value={name} onSave={(value) => setName(value)} />
                </div>
                <div className="grid grid-flow-row gap-10">
                    <InputsSection />
                    <PromptSection />
                    <OutputSection />
                </div>
            </div>
            <div className="p-8">
                <SaveAutomationButton />
            </div>
        </>
    )
}

function PromptSection() {
    const { prompt, setPrompt } = useAutomationContext();
    return (
        <SectionLayout title="Then Do...">
            <div className="w-full h-full min-w-96">
                <GlowingTextField
                    isLoading={false}
                    onInputChange={(e) => setPrompt({ text: e.target.value })}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                        }
                    }}
                    inputValue={prompt?.text || ''}
                    placeholders={['Write a short description of the task to be performed...']}
                    size={Size.Large}
                    shouldAllowKeyboardShortcutForFocus={true}
                    autoFocus={true}
                    focusOverride={null}
                />
            </div>
        </SectionLayout>
    )
}

function SaveAutomationButton() {
    return (
        <div className="flex justify-end">
            <Button 
                className="w-40 h-10 rounded-lg bg-[var(--color-accent)] text-[theme(text-primary)] transition-all duration-300 hover:scale-[1.02] hover:brightness-105"
                style={{
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = `
                        0 0 15px -5px var(--color-accent),
                        0 4px 10px rgba(0, 0, 0, 0.25)
                    `;
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                }}
            >
                Save
            </Button>
        </div>
    )
}

export default Automations;