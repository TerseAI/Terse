import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Settings, Clock } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import AutomationSetupTab from "./tabs/AutomationSetupTab";
import AutomationRunHistoryTab from "./tabs/AutomationRunHistoryTab";
import { useEffect, useState, useMemo } from "react";
import { useAutomation } from "../../hooks/api/useAutomations";
import { AutomationInput, AutomationOutput, AutomationPrompt } from "../../shared/types";

function AutomationDetail() {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    // Only pass automationId if it's not "new"
    const automationId = id && id !== 'new' ? id : null;

    // Fetch automation data using useSWR
    const { automation, isLoading: isFetching, mutate } = useAutomation(automationId);

    // Local state for editing
    const [name, setName] = useState<string | null>(null);
    const [inputs, setInputs] = useState<AutomationInput[]>([]);
    const [output, setOutput] = useState<AutomationOutput | undefined>(undefined);
    const [prompt, setPrompt] = useState<AutomationPrompt | undefined>(undefined);
    const [isActive, setIsActive] = useState<boolean>(true);

    // Sync local state with fetched data
    useEffect(() => {
        if (automation) {
            setName(automation.name);
            setInputs(automation.inputs);
            setOutput(automation.output);
            setPrompt(automation.prompt);
            setIsActive(automation.isActive);
        } else if (!automationId) {
            // Reset to blank state for new automation
            setName(null);
            setInputs([]);
            setOutput(undefined);
            setPrompt(undefined);
            setIsActive(true);
        }
    }, [automation, automationId]);

    const tabs = ['setup', 'history'] as const;
    const tabFromQuery = searchParams.get('tab');
    const [selectedIndex, setSelectedIndex] = useState(() => {
        return Math.max(0, tabs.indexOf((tabFromQuery as typeof tabs[number]) || 'setup'));
    });

    // Update selected index when URL changes
    useEffect(() => {
        const tabFromQuery = searchParams.get('tab');
        const newIndex = Math.max(0, tabs.indexOf((tabFromQuery as typeof tabs[number]) || 'setup'));
        setSelectedIndex(newIndex);
    }, [searchParams]);

    // Prepare props for child components
    const automationProps = {
        automationId,
        name,
        setName,
        inputs,
        setInputs,
        output,
        setOutput,
        prompt,
        setPrompt,
        isActive,
        setIsActive,
        isLoading: isFetching,
        mutate,
    }

    return (
        <div className="grid grid-cols-20 h-full pt-1">
            <div className="h-full min-h-0 col-span-20">
                <div className="mx-auto px-4 h-full min-h-0 flex flex-col">
                    <TabGroup selectedIndex={selectedIndex} onChange={(index) => {
                        setSelectedIndex(index);
                        const next = tabs[index];
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.set('tab', next);
                        setSearchParams(nextParams, { replace: true });
                    }}>
                        <TabList className="flex gap-2 border-b border-input">
                            <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                <Settings className="h-4 w-4" />
                                <span>Setup</span>
                            </Tab>
                            <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                <Clock className="h-4 w-4" />
                                <span>Run history</span>
                            </Tab>
                        </TabList>
                        <TabPanels className="flex-1 min-h-0 flex">
                            <TabPanel className="flex-1 min-h-0 flex flex-col">
                                <AutomationSetupTab {...automationProps} />
                            </TabPanel>
                            <TabPanel className="flex-1 min-h-0 flex flex-col">
                                <AutomationRunHistoryTab automationId={automationId} />
                            </TabPanel>
                        </TabPanels>
                    </TabGroup>
                </div>
            </div>
        </div>
    )
}

export default AutomationDetail;