import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Settings, Clock } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import ChannelSetupTab, { ChannelSetupTabProps } from "./tabs/ChannelSetupTab";
import ChannelRunHistoryTab from "./tabs/ChannelRunHistoryTab";
import { useEffect, useState} from "react";
import { useChannel } from "../../hooks/api/useChannels";
import { ChannelNotificationSettings, ChannelPrompt, TransientChannelInput, TransientChannelOutput } from "../../shared/types";
import { toTransientChannelInput, toTransientChannelOutput } from "../../utility/ChannelUtils";

function ChannelDetail() {
    const { id } = useParams<{ id: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    // Only pass channelId if it's not "new"
    const channelId = id && id !== 'new' ? id : null;

    // Fetch channel data using useSWR
    const { channel, isLoading: isFetching, mutate } = useChannel(channelId);

    // Local state for editing - use transient types for the editing interface
    const [name, setName] = useState<string | null>(null);
    const [inputs, setInputs] = useState<TransientChannelInput[]>([]);
    const [output, setOutput] = useState<TransientChannelOutput | undefined>(undefined);
    const [prompt, setPrompt] = useState<ChannelPrompt | undefined>(undefined);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [notificationSettings, setNotificationSettings] = useState<ChannelNotificationSettings>({
        enabled: false,
        actionTypes: [],
    });

    // Sync local state with fetched data - convert from ChannelInput/Output to Transient types
    useEffect(() => {
        if (channel) {
            setName(channel.name);
            setInputs(channel.inputs.map(toTransientChannelInput));
            setOutput(channel.output ? toTransientChannelOutput(channel.output) : undefined);
            setPrompt(channel.prompt);
            setIsActive(channel.isActive);
            setNotificationSettings(channel.notificationSettings ?? { enabled: false, actionTypes: [] });
        } else if (!channelId) {
            // Reset to blank state for new channel
            setName(null);
            setInputs([]);
            setOutput(undefined);
            setPrompt(undefined);
            setIsActive(true);
            setNotificationSettings({ enabled: false, actionTypes: [] });
        }
    }, [channel, channelId]);

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
    // Note: inputs and output are already in TransientChannelInput/Output format
    const channelProps: ChannelSetupTabProps = {
        channelId,
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
        notificationSettings,
        setNotificationSettings,
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
                                <ChannelSetupTab {...channelProps} />
                            </TabPanel>
                            <TabPanel className="flex-1 min-h-0 flex flex-col">
                                <ChannelRunHistoryTab channelId={channelId} />
                            </TabPanel>
                        </TabPanels>
                    </TabGroup>
                </div>
            </div>
        </div>
    )
}

export default ChannelDetail;