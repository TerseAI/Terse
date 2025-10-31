import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { ArrowLeft, Settings, Clock } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AutomationProvider } from "../../context/AutomationContext";
import AutomationSetupTab from "./tabs/AutomationSetupTab";
import AutomationRunHistoryTab from "./tabs/AutomationRunHistoryTab";
import { useEffect, useState } from "react";

function Automations() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Only pass automationId if it's not "new"
    const automationId = id && id !== 'new' ? id : undefined;

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

    return (
        <AutomationProvider automationId={automationId}>
            <div className="grid grid-cols-20 h-full pt-1">
                <div className="h-full min-h-0 col-span-20">
                    <div className="mx-auto px-6 h-full min-h-0 flex flex-col">
                        <TabGroup selectedIndex={selectedIndex} onChange={(index) => {
                            setSelectedIndex(index);
                            const next = tabs[index];
                            const nextParams = new URLSearchParams(searchParams);
                            nextParams.set('tab', next);
                            setSearchParams(nextParams, { replace: true });
                        }}>
                            <TabList className="flex gap-2 border-b border-input">
                                <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-foreground border-accent' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                    <Settings className="h-4 w-4" />
                                    <span>Setup</span>
                                </Tab>
                                <Tab className={({ selected }) => `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? 'text-foreground border-accent' : 'text-muted-foreground border-transparent hover:text-foreground'}`}>
                                    <Clock className="h-4 w-4" />
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