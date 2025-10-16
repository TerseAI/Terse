import TextareaAutosize from 'react-textarea-autosize';
import { AutomationProvider, useAutomationContext } from "../../context/AutomationContext";
import { InputsSection } from "./InputSection";
import { OutputSection } from "./OutputSection";

function Automations() {
    return (
        <AutomationProvider>
            <div className="grid grid-flow-row gap-4 overflow-y-auto min-w-0-auto p-8">
                <div className="grid grid-flow-row gap-10">
                    <InputsSection />
                    <PromptSection />
                    <OutputSection />
                </div>
            </div>
        </AutomationProvider>
    )
}

function PromptSection() {
    const { prompt, setPrompt } = useAutomationContext();
    return (
        <div className="grid grid-flow-col gap-4">
            <h1 className="text-lg font-bold text-[theme(text-primary)]">Then Do...</h1>
            <div className="grid grid-flow-col gap-4">
                <TextareaAutosize
                    value={prompt?.name}
                    onChange={(e) => setPrompt({ name: e.target.value })}
                    className="w-full h-full border-2 border-[theme(border)] rounded-md p-2"
                />
            </div>
        </div>
    )
}

export default Automations;