import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { ArrowLeftIcon, Cog6ToothIcon, ClockIcon } from "@heroicons/react/24/outline";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AutomationProvider } from "../../context/AutomationContext";
import AutomationSetupTab from "./tabs/AutomationSetupTab";
import AutomationRunHistoryTab from "./tabs/AutomationRunHistoryTab";

function Automations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Only pass automationId if it's not "new"
    const automationId = id && id !== 'new' ? id : undefined;

    const tabFromQuery = searchParams.get('tab');
    const tabs = ['setup', 'history'] as const;
    const initialIndex = Math.max(0, tabs.indexOf((tabFromQuery as typeof tabs[number]) || 'setup'));

    return (
        <AutomationProvider automationId={automationId}>
            <div className="flex flex-col h-full">
                <div className="py-3">
                    <button
                        onClick={() => navigate('/app/automations')}
                        className="inline-flex items-center gap-2 text-sm text-[theme(text-secondary)] hover:text-[theme(text-primary)] transition-colors pl-2 mt-1"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                        Back to Automations
                    </button>
                </div>
                <div className="flex-1 h-full min-h-0">
                    <div className="max-w-6xl mx-auto px-6 pt-4 h-full min-h-0 flex flex-col">
                        <TabGroup defaultIndex={initialIndex} onChange={(index) => {
                            const next = tabs[index];
                            const nextParams = new URLSearchParams(searchParams);
                            nextParams.set('tab', next);
                            setSearchParams(nextParams, { replace: true });
                        }}>
                            <TabList className="flex gap-2 border-b border-[theme(border)]">
                                <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-[theme(text-primary)] border-[var(--color-accent)]' : 'text-[theme(text-secondary)] border-transparent hover:text-[theme(text-primary)]'}`}>
                                    <Cog6ToothIcon className="h-4 w-4" />
                                    <span>Setup</span>
                                </Tab>
                                <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-[theme(text-primary)] border-[var(--color-accent)]' : 'text-[theme(text-secondary)] border-transparent hover:text-[theme(text-primary)]'}`}>
                                    <ClockIcon className="h-4 w-4" />
                                    <span>Run history</span>
                                </Tab>
                            </TabList>
                            <TabPanels className="flex-1 min-h-0 flex">
                                <TabPanel className="flex-1 min-h-0 flex flex-col">
                                    <AutomationSetupTab />
                                </TabPanel>
                                <TabPanel className="flex-1 min-h-0 flex flex-col">
                                    <AutomationRunHistoryTab />
                                </TabPanel>
                            </TabPanels>
                        </TabGroup>
                    </div>
                </div>
            </div>
        </AutomationProvider>
    )
}

export default Automations;