import { Input, useAutomationContext } from "../../context/AutomationContext";

export function InputsSection() {
    const { inputs, setInputs } = useAutomationContext();


    return (
        <div className="relative flex justify-center">
            <h1 className="absolute left-0 text-lg font-bold text-[theme(text-primary)]">Using Information From</h1>
            <div className="grid grid-flow-col gap-4">
                {inputs.map((input) => (
                    <div key={input.name}>
                        <h1 className="text-lg font-bold text-[theme(text-primary)]">{input.name}</h1>
                    </div>
                ))}
                <AddInputButton />
            </div>
        </div>
    )
}

export function AddInputButton() {
    const { inputs, setInputs } = useAutomationContext();

    const handleAddInput = () => {
        const newInput: Input = { name: 'New Input' };
        setInputs([...inputs, newInput]);
    }

    return (
        <div className="grid grid-flow-col gap-4">
            <button 
                onClick={handleAddInput}
                className="w-12 h-12 border-2 border-[theme(text-primary)] border-solid flex items-center justify-center p-3"
            >
                <svg className="w-6 h-6 text-[theme(text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </button>
        </div>
    )
}
