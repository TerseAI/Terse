import { Output, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { IntegrationBox, IntegrationInput } from "./components/Integration";
import { SectionLayout } from "./components/SectionLayout";

export function OutputSection() {
    const { output } = useAutomationContext();
    return (
        <SectionLayout title="And Put it Into">
            {output && (
                <IntegrationInput input={output} />
            )}
            <AddOutputButton />
        </SectionLayout>
    )   
}

function AddOutputButton() {
    const { setOutput } = useAutomationContext();

    const handleAddOutput = () => {
        const newOutput: Output = { integration: Integration.GITHUB };
        setOutput(newOutput);
    }

    return (
        <IntegrationBox>
            <button
                onClick={handleAddOutput}
            >
                <svg className="w-6 h-6 text-[theme(text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>    
            </button>
        </IntegrationBox>
    )
}