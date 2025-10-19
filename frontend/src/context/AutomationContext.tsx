import { createContext, useContext, useState, useEffect } from "react";
import { Integration } from "./Integrations";
import { BackendProvider } from "../services/backend";

export interface Input {
    integration: Integration;
}

export interface GithubInput {
    repositoryNames: string[];
    eventTypes: string[];
}

export enum GithubEventType {
    PUSH = 'push',
    PULL_REQUEST_OPENED = 'pull_request.opened',
    PULL_REQUEST_UPDATED = 'pull_request.updated',
    PULL_REQUEST_MERGED = 'pull_request.merged',
    PULL_REQUEST_CLOSED = 'pull_request.closed',
    PULL_REQUEST_COMMENT_ADDED = 'pull_request.comment_added',
}

export interface Output {
    integration: Integration;
}

export interface Prompt {
    text: string;
}

type AutomationContextType = {
    name: string;
    inputs: Input[];
    output: Output | undefined;
    prompt: Prompt | undefined;
    setName: (name: string) => void;
    setInputs: (inputs: Input[]) => void;
    setOutput: (output: Output | undefined) => void;
    setPrompt: (prompt: Prompt | undefined) => void;
}

const AutomationContext = createContext<AutomationContextType | undefined>(undefined);

export function AutomationProvider({ children }: { children: React.ReactNode }) {
    const [inputs, setInputs] = useState<Input[]>([]);
    const [output, setOutput] = useState<Output | undefined>(undefined);
    const [prompt, setPrompt] = useState<Prompt | undefined>(undefined);
    const [name, setName] = useState<string>('Untitled Automation');

    // Load automation on mount
    useEffect(() => {
        const loadAutomation = async () => {
            try {
                const automation = await BackendProvider.getUserAutomation();
                if (automation) {
                    setName(automation.name);
                    setInputs(automation.inputs.map(input => ({
                        integration: input.integration as Integration
                    })));
                    setOutput(automation.output ? {
                        integration: automation.output.integration as Integration
                    } : undefined);
                    setPrompt(automation.prompt);
                }
            } catch (error) {
                console.error('Error loading automation:', error);
            }
        };

        loadAutomation();
    }, []);

    return (
        <AutomationContext.Provider value={{ name, inputs, output, prompt, setName, setInputs, setOutput, setPrompt }}>
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