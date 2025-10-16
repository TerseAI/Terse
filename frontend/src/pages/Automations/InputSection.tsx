import { useState } from "react";
import { Input, useAutomationContext } from "../../context/AutomationContext";
import { Integration } from "../../context/Integrations";
import { IntegrationBox, IntegrationInput } from "./components/Integration";
import { SectionLayout } from "./components/SectionLayout";
import { AddInputModal } from "./components/AddInputModal";

export function InputsSection() {
    const { inputs } = useAutomationContext();

    return (
        <SectionLayout title="Using Information From">
            {inputs.map((input) => (
                <IntegrationInput key={input.integration} input={input} />
            ))}
            <AddInputButton />
        </SectionLayout>
    )
}

export function AddInputButton() {
    const { inputs, setInputs } = useAutomationContext();
    const [isOpen, setIsOpen] = useState(false);

    const handleAddInput = (integration: Integration) => {
        const newInput: Input = { integration };
        setInputs([...inputs, newInput]);
        setIsOpen(false);
    }

    return (
        <>
            <button onClick={() => setIsOpen(true)}>
                <IntegrationBox>
                    <svg className="w-6 h-6 text-[theme(text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                </IntegrationBox>
            </button>

            <AddInputModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onSelectIntegration={handleAddInput}
            />
        </>
    )
}
