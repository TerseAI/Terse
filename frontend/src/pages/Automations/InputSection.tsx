import { Input, useAutomationContext } from "../../context/AutomationContext";
import { IntegrationBox, IntegrationInput } from "./components/Integration";
import { SectionLayout } from "./components/SectionLayout";

export function InputsSection() {
    const { inputs, setInputs } = useAutomationContext();


    return (
        <SectionLayout title="Using Information From">
            {inputs.map((input) => (
                <IntegrationInput key={input} input={input} />
            ))}
            <AddInputButton />
        </SectionLayout>
    )
}

export function AddInputButton() {
    const { inputs, setInputs } = useAutomationContext();

    const handleAddInput = () => {
        const newInput: Input = { name: 'New Input' };
        setInputs([...inputs, newInput]);
    }

    return (
        <IntegrationBox>
            <button
                onClick={handleAddInput}
            >
                <svg className="w-6 h-6 text-[theme(text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </button>
        </IntegrationBox>
    )
}
