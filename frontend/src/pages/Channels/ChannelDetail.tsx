import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Settings, Clock } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import ChannelSetupTab, { ChannelSetupTabProps } from "./tabs/ChannelSetupTab";
import ChannelRunHistoryTab from "./tabs/ChannelRunHistoryTab";
import { useEffect, useState } from "react";
import { useChannel } from "../../hooks/api/useChannels";
import { useTemplates } from "../../hooks/api/useTemplates";
import { ChannelNotificationSettings, ChannelPrompt, TransientChannelInput, TransientChannelOutput, TransientKnowledgeBase } from "../../shared/types";
import { toTransientChannelInput, toTransientChannelOutput, toTransientKnowledgeBase } from "../../utility/ChannelUtils";
import { ConfigType } from "../../shared/Configs";
import { v4 as uuidv4 } from "uuid";

function ChannelDetail() {
    const { id, templateId } = useParams<{ id: string, templateId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    // Only pass channelId if it's not "new"
    const channelId: string | null = id && id !== 'new' ? id : null;

    // Fetch channel data using useSWR
    const { channel, isLoading: isFetching, mutate } = useChannel(channelId, templateId);

    // Fetch templates for template hydration
    const { templates, isLoading: isLoadingTemplates } = useTemplates();

    // Track if we've already hydrated from a template to avoid re-hydration
    const [templateHydrated, setTemplateHydrated] = useState<string | null>(null);

    // Local state for editing - use transient types for the editing interface
    const [name, setName] = useState<string | null>(null);
    const [inputs, setInputs] = useState<TransientChannelInput[]>([]);
    const [output, setOutput] = useState<TransientChannelOutput | undefined>(undefined);
    const [knowledgeBases, setKnowledgeBases] = useState<TransientKnowledgeBase[]>([]);
    const [prompt, setPrompt] = useState<ChannelPrompt | undefined>(undefined);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [requireApproval, setRequireApproval] = useState<boolean>(false);
    const [notificationSettings, setNotificationSettings] = useState<ChannelNotificationSettings>({
        enabled: false,
        actionTypes: [],
    });

    // Sync local state with fetched data - convert from ChannelInput/Output to Transient types
    useEffect(() => {
        if (!channelId) {
            // Check if we need to hydrate from a template
            if (templateId && templates.length > 0 && templateHydrated !== templateId) {
                const templateIndex = parseInt(templateId, 10);
                const template = templates[templateIndex];

                if (template) {
                    // Hydrate from template
                    setName(template.name);
                    setPrompt(template.prompt);
                    setIsActive(template.isActive ?? true);
                    setRequireApproval(template.requireApproval ?? false);

                    // Convert template inputs to transient inputs (config will be undefined, user needs to configure)
                    const transientInputs: TransientChannelInput[] = template.inputs.map(input => ({
                        id: uuidv4(),
                        configType: input.config.configType as ConfigType,
                        config: undefined, // User needs to select integration
                    }));
                    setInputs(transientInputs);

                    // Convert template output to transient output
                    if (template.output) {
                        setOutput({
                            id: uuidv4(),
                            configType: template.output.config.configType as ConfigType,
                            config: undefined, // User needs to select integration
                        });
                    } else {
                        setOutput(undefined);
                    }

                    // Convert template knowledge bases to transient knowledge bases
                    if (template.knowledgeBases && template.knowledgeBases.length > 0) {
                        const transientKBs: TransientKnowledgeBase[] = template.knowledgeBases.map(kb => ({
                            id: uuidv4(),
                            configType: kb.config.configType as ConfigType,
                            config: undefined, // User needs to select integration
                        }));
                        setKnowledgeBases(transientKBs);
                    } else {
                        setKnowledgeBases([]);
                    }

                    // Handle notification settings from template
                    if (template.notificationSettings) {
                        setNotificationSettings(template.notificationSettings);
                    } else {
                        setNotificationSettings({ enabled: false, actionTypes: [] });
                    }

                    setTemplateHydrated(templateId);
                    return;
                }
            }

            // Reset to blank state for new channel (no template)
            if (!templateId || templateHydrated === templateId) {
                // Only reset if there's no template or we've already handled it
                if (!templateId) {
                    setName(null);
                    setInputs([]);
                    setOutput(undefined);
                    setKnowledgeBases([]);
                    setPrompt(undefined);
                    setIsActive(true);
                    setRequireApproval(false);
                    setNotificationSettings({ enabled: false, actionTypes: [] });
                }
            }
        } else if (channel) {
            setName(channel.name);
            setInputs(channel.inputs.map(toTransientChannelInput));
            setOutput(channel.output ? toTransientChannelOutput(channel.output) : undefined);
            setKnowledgeBases(channel.knowledgeBases?.map(toTransientKnowledgeBase) || []);
            setPrompt(channel.prompt);
            setIsActive(channel.isActive);
            setRequireApproval(channel.requireApproval ?? false);
            setNotificationSettings(channel.notificationSettings ?? { enabled: false, actionTypes: [] });
        }
    }, [channel, channelId, templateId, templates, templateHydrated]);

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

    // Determine if we're still loading
    // - For existing channels: wait for channel data
    // - For template-based channels: wait for templates to load and hydrate
    const isLoading = isFetching || (!!templateId && (isLoadingTemplates || templateHydrated !== templateId));

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
        knowledgeBases,
        setKnowledgeBases,
        prompt,
        setPrompt,
        isActive,
        setIsActive,
        requireApproval,
        setRequireApproval,
        notificationSettings,
        setNotificationSettings,
        isLoading,
        mutate,
        updatedAt: channel?.updatedAt,
    }

    return (
        <div className="grid grid-cols-20 h-full pt-2 pl-2">
            <div className="h-full min-h-0 col-span-20">
                <div className="mx-auto h-full min-h-0 flex flex-col h-full">
                    <TabGroup selectedIndex={selectedIndex} className="h-full" onChange={(index) => {
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
                                <span>Activity</span>
                            </Tab>
                        </TabList>
                        <TabPanels className="flex-1 min-h-0 h-full flex">
                            <TabPanel className="flex-1 min-h-0 h-full flex flex-col">
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