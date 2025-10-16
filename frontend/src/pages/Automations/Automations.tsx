import TextareaAutosize from 'react-textarea-autosize';
import { AutomationProvider, useAutomationContext } from "../../context/AutomationContext";
import { InputsSection } from "./InputSection";
import { OutputSection } from "./OutputSection";
import { SectionLayout } from "./components/SectionLayout";

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
        <SectionLayout title="Then Do...">
            <TextareaAutosize
                value={prompt?.text}
                onChange={(e) => setPrompt({ text: e.target.value })}
                className="w-full h-full min-w-96 border-2 border-[theme(border)] rounded-md p-2"
            />
        </SectionLayout>
    )
}

export default Automations;