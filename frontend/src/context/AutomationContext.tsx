import { createContext, useContext, useEffect, useState } from "react";
import { BackendProvider } from "../services/backend";
import { Integration } from "./Integrations";
import { NotionConfig, NotionPageConfig, SlackConfig } from "../shared/types";

export interface Input {
    integration: Integration;
    integrationId?: string; // ID of the specific integration instance
    notionConfig?: NotionConfig; // Configuration for Notion input (database selection)
    slackConfig?: SlackConfig; // Configuration for Slack input (channel selection)
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
    integrationId?: string; // ID of the specific integration instance
    notionConfig?: NotionConfig; // Configuration for Notion output (database selection)
    notionPageConfig?: NotionPageConfig; // Configuration for Notion output (page selection)
    slackConfig?: SlackConfig; // Configuration for Slack output (channel selection)
}

export interface Prompt {
    text: string;
}

type AutomationContextType = {
    automationId: string | null;
    name: string | null;
    inputs: Input[];
    output: Output | undefined;
    prompt: Prompt | undefined;
    isActive: boolean;
    isLoading: boolean;
    setName: (name: string) => void;
    setInputs: (inputs: Input[]) => void;
    setOutput: (output: Output | undefined) => void;
    setPrompt: (prompt: Prompt | undefined) => void;
    setIsActive: (isActive: boolean) => void;
    loadAutomation: (id: string) => Promise<void>;
    reset: () => void;
}

const AutomationContext = createContext<AutomationContextType | undefined>(undefined);

export function AutomationProvider({ children, automationId }: { children: React.ReactNode; automationId?: string }) {
    const [id, setId] = useState<string | null>(automationId || null);
    const [inputs, setInputs] = useState<Input[]>([]);
    const [output, setOutput] = useState<Output | undefined>(undefined);
    const [prompt, setPrompt] = useState<Prompt | undefined>(undefined);
    const [name, setName] = useState<string | null>(null);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadAutomation = async (automationId: string) => {
        try {
            setIsLoading(true);
            const automation = await BackendProvider.getAutomationById(automationId);
            if (automation) {
                setId(automation.id);
                setName(automation.name);
                setInputs(automation.inputs.map(input => ({
                    integration: input.integration as Integration,
                    integrationId: input.integrationId,
                    notionConfig: input.notionConfig,
                    slackConfig: input.slackConfig
                })));
                setOutput(automation.output ? {
                    integration: automation.output.integration as Integration,
                    integrationId: automation.output.integrationId,
                    notionConfig: automation.output.notionConfig,
                    notionPageConfig: automation.output.notionPageConfig,
                    slackConfig: automation.output.slackConfig
                } : undefined);
                setPrompt(automation.prompt);
                setIsActive(automation.isActive);
            }
        } catch (error) {
            console.error('Error loading automation:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const reset = () => {
        setId(null);
        setName('Untitled Automation');
        setInputs([]);
        setOutput(undefined);
        setPrompt(undefined);
        setIsActive(true);
    };

    // Load automation on mount if ID is provided
    useEffect(() => {
        if (automationId) {
            loadAutomation(automationId);
        }
    }, [automationId]);

    return (
        <AutomationContext.Provider value={{
            automationId: id,
            name,
            inputs,
            output,
            prompt,
            isActive,
            isLoading,
            setName,
            setInputs,
            setOutput,
            setPrompt,
            setIsActive,
            loadAutomation,
            reset
        }}>
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