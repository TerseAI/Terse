import { useState } from "react";
import { Output, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { IntegrationBox, IntegrationInput } from "./components/Integration";
import { SectionLayout } from "./components/SectionLayout";
import { AddOutputModal } from "./components/AddOutputModal";

export function OutputSection() {
    const { output, setOutput } = useAutomationContext();
    return (
        <SectionLayout title="And Put it Into">
            {output && (
                <IntegrationInput input={output} onRemove={() => setOutput(undefined)} />
            )}
            <AddOutputButton />
        </SectionLayout>
    )   
}

function AddOutputButton() {
    const { setOutput } = useAutomationContext();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSelectIntegration = (integration: Integration) => {
        const newOutput: Output = { integration };
        setOutput(newOutput);
        setIsModalOpen(false);
    }

    return (
        <>
            <IntegrationBox>
                <button
                    onClick={() => setIsModalOpen(true)}
                >
                    <svg className="w-6 h-6 text-[theme(text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>    
                </button>
            </IntegrationBox>
            <AddOutputModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelectIntegration={handleSelectIntegration}
            />
        </>
    )
}