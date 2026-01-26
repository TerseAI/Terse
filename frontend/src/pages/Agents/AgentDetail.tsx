import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { Settings, Clock } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import AgentSetupTab, { AgentSetupTabProps } from "./tabs/AgentSetupTab";
import AgentRunHistoryTab from "./tabs/AgentRunHistoryTab";
import { useEffect, useState } from "react";
import { useAgent } from "../../hooks/api/useAgents";
import { useTemplates } from "../../hooks/api/useTemplates";
import { AgentNotificationSettings, AgentPrompt, TransientAgentTrigger, TransientAgentOutput, TransientKnowledgeBase } from "../../shared/types";
import { toTransientAgentTrigger, toTransientAgentOutput, toTransientKnowledgeBase } from "../../utility/AgentUtils";
import { useTemplateHydration } from "../../hooks/useTemplateHydration";

function AgentDetail() {
    const { id, templateId } = useParams<{ id: string, templateId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();

    // Only pass agentId if it's not "new"
    const agentId: string | null = id && id !== 'new' ? id : null;

    // Fetch agent data using useSWR
    const { agent, isLoading: isFetching, mutate } = useAgent(agentId);

    // Fetch templates for template hydration
    const { templates, isLoading: isLoadingTemplates } = useTemplates();

    // Hydrate from template if templateId is provided
    const { hydratedState: templateHydratedState, templateFound } = useTemplateHydration(templateId, templates);

    // Track if we've already hydrated from a template to avoid re-hydration
    const [templateHydrated, setTemplateHydrated] = useState<string | null>(null);

    // Local state for editing - use transient types for the editing interface
    const [name, setName] = useState<string | null>(null);
    const [inputs, setInputs] = useState<TransientAgentTrigger[]>([]);
    const [outputs, setOutputs] = useState<TransientAgentOutput[]>([]);
    const [knowledgeBases, setKnowledgeBases] = useState<TransientKnowledgeBase[]>([]);
    const [prompt, setPrompt] = useState<AgentPrompt | undefined>(undefined);
    const [isActive, setIsActive] = useState<boolean>(true);
    const [requireApproval, setRequireApproval] = useState<boolean>(false);
    const [toolApprovals, setToolApprovals] = useState<string[]>([]);
    const [notificationSettings, setNotificationSettings] = useState<AgentNotificationSettings>({
        enabled: false,
        actionTypes: [],
    });

    // Sync local state with fetched data - convert from AgentTrigger/Output to Transient types
    useEffect(() => {
        if (!agentId) {
            // Check if we need to hydrate from a template
            if (templateId && templateFound && templateHydratedState && templateHydrated !== templateId) {
                // Hydrate from template
                setName(templateHydratedState.name);
                setPrompt(templateHydratedState.prompt);
                setIsActive(templateHydratedState.isActive);
                setRequireApproval(templateHydratedState.requireApproval);
                setToolApprovals(templateHydratedState.toolApprovals || []);
                setInputs(templateHydratedState.inputs);
                setOutputs(templateHydratedState.outputs);
                setKnowledgeBases(templateHydratedState.knowledgeBases);
                setNotificationSettings(templateHydratedState.notificationSettings);
                setTemplateHydrated(templateId);
                return;
            }

            // Reset to blank state for new agent (no template)
            if (!templateId || templateHydrated === templateId) {
                // Only reset if there's no template or we've already handled it
                if (!templateId) {
                    setName(null);
                    setInputs([]);
                    setOutputs([]);
                    setKnowledgeBases([]);
                    setPrompt(undefined);
                    setIsActive(true);
                    setRequireApproval(false);
                    setToolApprovals([]);
                    setNotificationSettings({ enabled: false, actionTypes: [] });
                }
            }
        } else if (agent) {
            setName(agent.name);
            setInputs(agent.triggers.map(toTransientAgentTrigger));
            setOutputs(agent.outputs ? agent.outputs.map(toTransientAgentOutput) : []);
            setKnowledgeBases(agent.knowledgeBases?.map(toTransientKnowledgeBase) || []);
            setPrompt(agent.prompt);
            setIsActive(agent.isActive);
            setRequireApproval(agent.requireApproval ?? false);
            setToolApprovals(agent.toolApprovals || []);
            setNotificationSettings(agent.notificationSettings ?? { enabled: false, actionTypes: [] });
        }
    }, [agent, agentId, templateId, templateFound, templateHydratedState, templateHydrated]);

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
    // - For existing agents: wait for agent data
    // - For template-based agents: wait for templates to load and hydrate
    const isLoading = isFetching || (!!templateId && (isLoadingTemplates || !templateFound || templateHydrated !== templateId));

    // Prepare props for child components
    // Note: inputs and outputs are already in TransientAgentTrigger/Output format
    const agentProps: AgentSetupTabProps = {
        agentId,
        name,
        setName,
        inputs,
        setInputs,
        outputs,
        setOutputs,
        knowledgeBases,
        setKnowledgeBases,
        prompt,
        setPrompt,
        isActive,
        setIsActive,
        requireApproval,
        setRequireApproval,
        toolApprovals,
        setToolApprovals,
        notificationSettings,
        setNotificationSettings,
        isLoading,
        mutate,
        updatedAt: agent?.updatedAt,
    }

    return (
        <div className="grid grid-cols-20 h-full pt-2 pl-2">
            <div className="h-full min-h-0 col-span-20">
                <div className="mx-auto h-full min-h-0 flex flex-col h-full">
                    <TabGroup selectedIndex={selectedIndex} className="h-full flex flex-col" onChange={(index) => {
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
                        <TabPanels className="flex-1 min-h-0 flex">
                            <TabPanel className="flex-1 min-h-0 h-full flex flex-col">
                                <AgentSetupTab {...agentProps} />
                            </TabPanel>
                            <TabPanel className="flex-1 min-h-0 flex flex-col">
                                <AgentRunHistoryTab agentId={agentId} />
                            </TabPanel>
                        </TabPanels>
                    </TabGroup>
                </div>
            </div>
        </div>
    )
}

export default AgentDetail;