import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Settings, Clock, Package } from "lucide-react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import AutomationSetupTab from "./tabs/AutomationSetupTab";
import AutomationRunHistoryTab from "./tabs/AutomationRunHistoryTab";
import AutomationProductionTab from "./tabs/AutomationProductionTab";
import { useEffect, useState} from "react";
import { useAutomation } from "../../hooks/api/useAutomations";
import { AutomationInput, AutomationOutput, AutomationPrompt } from "../../shared/types";

function AutomationDetail() {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    // Redirect /new to automations list (shouldn't happen, but handle gracefully)
    const automationId = id && id !== 'new' ? id : null;
    
    // If someone navigates to /new, redirect them (shouldn't happen with new flow)
    useEffect(() => {
        if (id === 'new') {
            navigate('/app/automations', { replace: true });
        }
    }, [id, navigate]);

    // Fetch automation data using useSWR
    const { automation, isLoading: isFetching, mutate } = useAutomation(automationId);

    // Local state for editing
    const [name, setName] = useState<string | null>(null);
    const [inputs, setInputs] = useState<AutomationInput[]>([]);
    const [output, setOutput] = useState<AutomationOutput | undefined>(undefined);
    const [prompt, setPrompt] = useState<AutomationPrompt | undefined>(undefined);
    const [isActive, setIsActive] = useState<boolean>(true);

    // Sync local state with fetched data - use draft version for editing
    useEffect(() => {
        if (automation) {
            setName(automation.name);
            // Use draft version if available, otherwise initialize from production
            if (automation.draft) {
                setInputs(automation.draft.inputs || []);
                setOutput(automation.draft.output);
                setPrompt(automation.draft.prompt);
            } else if (automation.production) {
                // Initialize draft from production if no draft exists
                setInputs(automation.production.inputs || []);
                setOutput(automation.production.output);
                setPrompt(automation.production.prompt);
            } else {
                // Fallback to root level (backward compatibility)
                setInputs(automation.inputs || []);
                setOutput(automation.output);
                setPrompt(automation.prompt);
            }
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

    // Determine available tabs based on automation state
    const hasProduction = !!automation?.production;
    const tabs: readonly ('production' | 'edit' | 'history')[] = hasProduction 
        ? (['production', 'edit', 'history'] as const)
        : (['edit', 'history'] as const);
    
    type TabType = 'production' | 'edit' | 'history';
    
    const tabFromQuery = searchParams.get('tab');
    const [selectedIndex, setSelectedIndex] = useState(() => {
        const defaultTab: TabType = hasProduction ? 'production' : 'edit';
        return Math.max(0, tabs.indexOf((tabFromQuery as TabType) || defaultTab));
    });

    // Update selected index when URL changes
    useEffect(() => {
        const tabFromQuery = searchParams.get('tab');
        const defaultTab: TabType = hasProduction ? 'production' : 'edit';
        const newIndex = Math.max(0, tabs.indexOf((tabFromQuery as TabType) || defaultTab));
        setSelectedIndex(newIndex);
    }, [searchParams, hasProduction, tabs]);

    // Handle publish success - switch to production tab
    const handlePublishSuccess = () => {
        mutate(); // Refresh automation data
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set('tab', 'production');
        setSearchParams(nextParams, { replace: true });
    };

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
        productionVersion: automation?.production,
        onPublishSuccess: handlePublishSuccess,
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
                            {hasProduction && (
                                <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                    <Package className="h-4 w-4" />
                                    <span>Production</span>
                                </Tab>
                            )}
                            <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                <Settings className="h-4 w-4" />
                                <span>Edit</span>
                            </Tab>
                            <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-foreground border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                <Clock className="h-4 w-4" />
                                <span>Run history</span>
                            </Tab>
                        </TabList>
                        <TabPanels className="flex-1 min-h-0 flex">
                            {hasProduction && (
                                <TabPanel className="flex-1 min-h-0 flex flex-col">
                                    <AutomationProductionTab 
                                        automationId={automationId} 
                                        productionVersion={automation.production}
                                        automationName={automation.name}
                                    />
                                </TabPanel>
                            )}
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