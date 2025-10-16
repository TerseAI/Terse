import { Output, useAutomationContext } from "../../context/AutomationContext";

export function OutputSection() {
    const { output } = useAutomationContext();
    return (
        <div className="grid grid-flow-col gap-4">
            <h1 className="text-lg font-bold text-[theme(text-primary)]">And Put it Into</h1>

            <div className="grid grid-flow-row gap-4">
                {output && (
                    <div key={output.name}>
                        <h1 className="text-lg font-bold text-[theme(text-primary)]">{output.name}</h1>
                    </div>
                )}
                <AddOutputButton />
            </div>
        </div>
    )
}

function AddOutputButton() {
    const { output, setOutput } = useAutomationContext();

    const handleAddOutput = () => {
        const newOutput: Output = { name: 'New Output' };
        setOutput(newOutput);
    }

    return (
        <div className="grid grid-flow-col gap-4">
        <button 
                onClick={handleAddOutput}
                className="w-12 h-12 border-2 border-[theme(text-primary)] border-solid flex items-center justify-center p-3"
            >
                <svg className="w-6 h-6 text-[theme(text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
            </button>
        </div>
    )
}