import { createContext, useContext, useState } from "react";
import { Integration } from "./Integrations";

export interface Input {
    integration: Integration;
}

export interface Output {
    integration: Integration;
}

export interface Prompt {
    text: string;
}

type AutomationContextType = {
    inputs: Input[];
    output: Output | undefined;
    prompt: Prompt | undefined;
    setInputs: (inputs: Input[]) => void;
    setOutput: (output: Output | undefined) => void;
    setPrompt: (prompt: Prompt | undefined) => void;
}

const AutomationContext = createContext<AutomationContextType | undefined>(undefined);

export function AutomationProvider({ children }: { children: React.ReactNode }) {
    const [inputs, setInputs] = useState<Input[]>([]);
    const [output, setOutput] = useState<Output | undefined>(undefined);
    const [prompt, setPrompt] = useState<Prompt | undefined>(undefined);

    return (
        <AutomationContext.Provider value={{ inputs, output, prompt, setInputs, setOutput, setPrompt }}>
            {children}
        </AutomationContext.Provider>
    )
}

export function useAutomationContext() {
    const context = useContext(AutomationContext);
    if (!context) {
        throw new Error('useAutomationContext must be used within a AutomationProvider');
    }
    return context;
}