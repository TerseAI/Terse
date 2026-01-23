import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FrontendRoutes } from "@/shared/FrontendRoutes";
import EditableTextField from '../../../components/ui/EditableTextField';
import { AgentKnowledgeBase, AgentNotificationSettings as AgentNotificationSettingsType, AgentUpdate, TransientAgentTrigger, TransientAgentOutput } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultAgentName, toAgentTrigger, toAgentOutput, toAgentKnowledgeBase } from "@/utility/AgentUtils";
import { useAgentCount } from "@/hooks/api/useAgentCount";
import { useAgentMutations } from "@/hooks/api/useAgents";
import { type KeyedMutator } from 'swr';
import { Agent, AgentTrigger, AgentOutput, AgentPrompt, TransientKnowledgeBase } from "@/shared/types";
import { AddTriggerModal } from "../components/AddTriggerModal";
import { AddKnowledgeBaseModal } from "../components/AddKnowledgeBaseModal";
import { AddOutputModal } from "../components/AddOutputModal";
import { KnowledgeBaseSelector } from "../components/KnowledgeBaseSelector";
import { CONFIG_DETAILS, ConfigInstance, ConfigType } from "../../../shared/Configs";
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { InputConfigSelectorProps, IntegrationSelector } from "../../../components/IntegrationSelector";
import { AlertTriangleIcon, PlusIcon, XIcon, Zap, FileText, Wrench, Bell, Info, Database } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import AgentNotificationSettings from "../AgentNotificationSettings";
import AgentApprovalSettings from "../AgentApprovalSettings";
import { InstructionsEditor } from "../components/InstructionsEditor";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../../components/ui/tooltip";
import { IconForConfigType } from "../components/Integration";
import { AppsList } from "../../../components/Agents";

export type AgentSetupTabProps = {
    agentId: string | null;
    name: string | null;
    setName: (name: string) => void;
    inputs: TransientAgentTrigger[];
    setInputs: (inputs: TransientAgentTrigger[]) => void;
    outputs: TransientAgentOutput[];
    setOutputs: (outputs: TransientAgentOutput[]) => void;
    knowledgeBases: TransientKnowledgeBase[];
    setKnowledgeBases: (knowledgeBases: TransientKnowledgeBase[]) => void;
    prompt: AgentPrompt | undefined;
    setPrompt: (prompt: AgentPrompt | undefined) => void;
    isActive: boolean;
    setIsActive: (isActive: boolean) => void;
    requireApproval: boolean;
    setRequireApproval: (requireApproval: boolean) => void;
    toolApprovals: string[];
    setToolApprovals: (toolApprovals: string[]) => void;
    notificationSettings: AgentNotificationSettingsType;
    setNotificationSettings: (settings: AgentNotificationSettingsType) => void;
    isLoading: boolean;
    mutate: KeyedMutator<Agent>;
    updatedAt?: string;
};

function SaveAgentButton({
    defaultName,
    agentId,
    name,
    inputs,
    outputs,
    knowledgeBases,
    prompt,
    isActive,
    requireApproval,
    toolApprovals,
    notificationSettings,
    mutate,
    onSaveSuccess
}: {
    defaultName: string;
    agentId: string | null;
    name: string | null;
    inputs: AgentTrigger[];
    outputs: AgentOutput[];
    knowledgeBases: AgentKnowledgeBase[];
    prompt: AgentPrompt | undefined;
    isActive: boolean;
    requireApproval: boolean;
    toolApprovals: string[];
    notificationSettings: AgentNotificationSettingsType;
    mutate: KeyedMutator<Agent>;
    onSaveSuccess?: () => void;
}) {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const { createAgent, updateAgent } = useAgentMutations();

    // Validation: all required fields must be present
    // Each integration reports its own completeness
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => i != null && i.config != null && i.config.isComplete()) &&
        outputs.length > 0 &&
        outputs.every(o => o != null && o.config != null && o.config.isComplete()) &&
        !!prompt?.text; // Ensure prompt is not empty

    const isEditMode = !!agentId;

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !outputs.length) return;

        setIsSaving(true);
        try {
            const agentData: AgentUpdate = {
                name: name || defaultName || '',
                triggers: inputs,
                outputs,
                knowledgeBases,
                prompt,
                isActive,
                requireApproval,
                toolApprovals,
                notificationSettings
            };

            if (isEditMode) {
                // Update existing agent
                await updateAgent({
                    id: agentId!,
                    data: agentData,
                    mutateAgent: mutate,
                });
            } else if (isComplete && agentData.outputs && agentData.outputs.length > 0 && agentData.triggers && agentData.triggers.length > 0) {
                // Create new agent
                const creation = await createAgent(agentData);

                if (creation?.id) {
                    navigate(FrontendRoutes.AGENTS.DETAIL(creation.id), { replace: true });
                }
            }

            toast.success('Agent saved successfully');

            // Notify parent that save was successful
            onSaveSuccess?.();

            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
            }, 1000);
        } catch (error) {
            console.error('Error saving agent:', error);
            alert('Failed to save agent. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Button
            onClick={handleSave}
            disabled={!isComplete || isSaving}
            className="min-w-24 w-fit"
        >
            {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : isComplete ? 'Save' : 'Complete All Steps'}
        </Button>
    )
}

export default function AgentSetupTab({
    agentId,
    name,
    setName,
    inputs,
    outputs,
    knowledgeBases,
    prompt,
    setInputs,
    setOutputs,
    setKnowledgeBases,
    setPrompt,
    isActive,
    requireApproval,
    setRequireApproval: _setRequireApproval, // Kept for backward compatibility but not used (we use toolApprovals instead)
    notificationSettings,
    setNotificationSettings,
    toolApprovals,
    setToolApprovals,
    mutate,
}: AgentSetupTabProps) {
    const { totalCount } = useAgentCount();
    const defaultName = getDefaultAgentName(totalCount);

    const agentInputs = inputs.map(toAgentTrigger).filter((i): i is AgentTrigger => i != null);
    const agentOutputs = outputs.map(toAgentOutput).filter((o): o is AgentOutput => o != null);
    const agentKnowledgeBases = knowledgeBases.map(toAgentKnowledgeBase).filter((kb): kb is AgentKnowledgeBase => kb != null);

    type SetupSection = 'triggers' | 'knowledgeBase' | 'prompt' | 'skills' | 'alerts';
    const [activeSection, setActiveSection] = useState<SetupSection>('triggers');

    const triggersIncomplete =
        inputs.length === 0 || inputs.some((i) => !i || !i.config || !i.config.isComplete());
    const knowledgeBaseIncomplete = knowledgeBases.some((kb) => !kb || !kb.config || !kb.config.isComplete());
    const promptIncomplete = !prompt?.text || prompt.text.trim() === '';
    const skillsIncomplete = outputs.length === 0 || outputs.some((o) => !o || !o.config || !o.config.isComplete());

    // Check if automation is complete (same logic as SaveAgentButton)
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => i != null && i.config != null && i.config.isComplete()) &&
        outputs.length > 0 &&
        outputs.every(o => o != null && o.config != null && o.config.isComplete()) &&
        !!prompt?.text;

    // Create a minimal agent-like object for AppsList
    // Only create if we have outputs (required by Agent type)
    const agentForAppsList = agentOutputs.length > 0 ? {
        id: agentId || '',
        name: name || defaultName || '',
        isActive,
        requireApproval,
        prompt: prompt || { text: '' },
        triggers: agentInputs,
        outputs: agentOutputs,
        knowledgeBases: agentKnowledgeBases,
        notificationSettings,
    } : null;

    return (
        <div className="flex flex-col h-full min-h-0 gap-0">
            <div className="py-6">
                <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="flex justify-start min-w-0 pl-2">
                        <SaveAgentButton
                            defaultName={defaultName}
                            agentId={agentId}
                            name={name}
                            inputs={agentInputs}
                            outputs={agentOutputs}
                            knowledgeBases={agentKnowledgeBases}
                            prompt={prompt}
                            isActive={isActive}
                            requireApproval={requireApproval}
                            toolApprovals={toolApprovals}
                            notificationSettings={notificationSettings}
                            mutate={mutate}
                        />
                    </div>
                    <div className="flex justify-center items-center min-w-0">
                        <EditableTextField className="text-center max-w-fit" value={name || ''} placeholder={defaultName} onSave={(value) => setName(value)} />
                    </div>
                    <div className="flex justify-end min-w-0 items-center gap-3 px-2">
                        {isComplete && agentForAppsList ? (
                            <>
                                <AppsList agent={agentForAppsList} />
                            </>
                        ) : (
                            <div className="text-sm text-muted-foreground text-right">
                                Complete your automation to see connected apps
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-0 overflow-hidden relative">
                <nav className="shrink-0 md:w-46 h-full relative md:-mt-2 z-10 border-t border-r border-border">
                    <div className="flex md:flex-col gap-4 md:pr-4 overflow-x-auto md:overflow-visible pt-4 h-full">
                        <Button
                            type="button"
                            variant={activeSection === 'triggers' ? "secondary" : "ghost"}
                            size="sm"
                            className={cn("w-auto md:w-full justify-start text-base", activeSection === 'triggers' && "font-medium")}
                            onClick={() => setActiveSection('triggers')}
                            aria-current={activeSection === 'triggers' ? 'page' : undefined}
                        >
                            <span className="flex items-center gap-2 w-full">
                                <Zap className="size-4" />
                                <span>Triggers</span>
                                {triggersIncomplete && (
                                    <div className="ml-auto">
                                        <WarningIcon content="Add at least one trigger integration and complete its configuration to remove this warning." />
                                    </div>
                                )}
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant={activeSection === 'prompt' ? "secondary" : "ghost"}
                            size="sm"
                            className={cn("w-auto md:w-full justify-start text-base", activeSection === 'prompt' && "font-medium")}
                            onClick={() => setActiveSection('prompt')}
                            aria-current={activeSection === 'prompt' ? 'page' : undefined}
                        >
                            <span className="flex items-center gap-2 w-full">
                                <FileText className="size-4" />
                                <span>Prompt</span>
                                {promptIncomplete && (
                                    <div className="ml-auto">
                                        <WarningIcon content="Add a prompt describing what the AI should do with incoming events to remove this warning." />
                                    </div>
                                )}
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant={activeSection === 'skills' ? "secondary" : "ghost"}
                            size="sm"
                            className={cn("w-auto md:w-full justify-start text-base", activeSection === 'skills' && "font-medium")}
                            onClick={() => setActiveSection('skills')}
                            aria-current={activeSection === 'skills' ? 'page' : undefined}
                        >
                            <span className="flex items-center gap-2 w-full">
                                <Wrench className="size-4" />
                                <span>Skills</span>
                                {skillsIncomplete && (
                                    <div className="ml-auto">
                                        <WarningIcon content="Select a skill destination and complete its configuration to remove this warning." />
                                    </div>
                                )}
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant={activeSection === 'knowledgeBase' ? "secondary" : "ghost"}
                            size="sm"
                            className={cn("w-auto md:w-full justify-start text-base", activeSection === 'knowledgeBase' && "font-medium")}
                            onClick={() => setActiveSection('knowledgeBase')}
                            aria-current={activeSection === 'knowledgeBase' ? 'page' : undefined}
                        >
                            <span className="flex items-center gap-2 w-full">
                                <Database className="size-4" />
                                <span>Knowledge Base</span>
                                {knowledgeBaseIncomplete && knowledgeBases.length > 0 && (
                                    <div className="ml-auto">
                                        <WarningIcon content="Complete knowledge base configuration to remove this warning." />
                                    </div>
                                )}
                            </span>
                        </Button>
                        <Button
                            type="button"
                            variant={activeSection === 'alerts' ? "secondary" : "ghost"}
                            size="sm"
                            className={cn("w-auto md:w-full justify-start text-base", activeSection === 'alerts' && "font-medium")}
                            onClick={() => setActiveSection('alerts')}
                            aria-current={activeSection === 'alerts' ? 'page' : undefined}
                        >
                            <span className="flex items-center gap-2 w-full">
                                <Bell className="size-4" />
                                <span>Alerts</span>
                            </span>
                        </Button>
                    </div>
                </nav>

                <div className="flex-1 min-h-0 overflow-hidden pl-6">
                    <div className="h-full min-h-0 overflow-y-auto pr-1">
                        {activeSection === 'triggers' && (
                            <div className="max-w-3xl flex flex-col gap-4">
                                <InputLayout inputs={inputs} setInputs={setInputs} isIncomplete={triggersIncomplete} agentId={agentId} />
                            </div>
                        )}

                        {activeSection === 'knowledgeBase' && (
                            <div className="max-w-3xl flex flex-col gap-4">
                                <KnowledgeBaseLayout knowledgeBases={knowledgeBases} setKnowledgeBases={setKnowledgeBases} isIncomplete={knowledgeBaseIncomplete} />
                            </div>
                        )}

                        {activeSection === 'prompt' && (
                            <div className="max-w-4xl flex flex-col gap-4">
                                <div className="h-[70vh] min-h-[420px] overflow-hidden">
                                    <InstructionsEditor
                                        prompt={prompt}
                                        setPrompt={setPrompt}
                                        agentInputs={agentInputs}
                                        agentOutputs={agentOutputs}
                                        knowledgeBases={agentKnowledgeBases}
                                        isIncomplete={promptIncomplete}
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'skills' && (
                            <div className="max-w-3xl flex flex-col gap-4 pr-6">
                                <OutputLayout outputs={outputs} setOutputs={setOutputs} isIncomplete={skillsIncomplete} agentId={agentId} />
                            </div>
                        )}

                        {activeSection === 'alerts' && (
                            <div className="max-w-3xl flex flex-col gap-4">
                                <div className="flex flex-row gap-2 items-center mb-2">
                                    <SectionHeader>Alerts</SectionHeader>
                                    <SectionInfoIcon
                                        isIncomplete={false}
                                        alertMessage=""
                                        infoMessage="Configure approval requirements and notification settings for when the AI takes actions on your behalf."
                                    />
                                </div>
                                <AgentApprovalSettings 
                                    outputs={outputs}
                                    knowledgeBases={knowledgeBases}
                                    toolApprovals={toolApprovals}
                                    onToolApprovalsChange={setToolApprovals}
                                />
                                <AgentNotificationSettings settings={notificationSettings} onChange={setNotificationSettings} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function SectionInfoIcon({
    isIncomplete,
    alertMessage,
    infoMessage
}: {
    isIncomplete: boolean;
    alertMessage: string;
    infoMessage: string;
}) {
    const tooltipContent = isIncomplete
        ? `${alertMessage}\n\n${infoMessage}`
        : infoMessage;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {isIncomplete ? (
                    <AlertTriangleIcon className="size-3 text-yellow-500 cursor-help relative -top-1" />
                ) : (
                    <Info className="size-3 text-muted-foreground hover:text-foreground cursor-help relative -top-1" />
                )}
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs whitespace-pre-line">
                {tooltipContent}
            </TooltipContent>
        </Tooltip>
    );
}

function WarningIcon({ content }: { content: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <AlertTriangleIcon className="size-4 text-yellow-500 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
                {content}
            </TooltipContent>
        </Tooltip>
    );
}

function InputLayout({ inputs, setInputs, isIncomplete, agentId }: { inputs: TransientAgentTrigger[], setInputs: (inputs: TransientAgentTrigger[]) => void, isIncomplete: boolean, agentId: string | null }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (config: ConfigType) => {
        const newInputId = uuidv4(); // We need to mint a placeholder ID for the new input so that we can identify it later.
        const newInput: TransientAgentTrigger = { id: newInputId, config: undefined, configType: config };
        const newInputs: TransientAgentTrigger[] = [...inputs, newInput];
        setInputs(newInputs);
        setShowAddModal(false);
    };

    const handleRemove = (id: string) => {
        setInputs(inputs.filter(input => input.id !== id));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row gap-2 items-center mb-2">
                <SectionHeader>Triggers</SectionHeader>
                <SectionInfoIcon
                    isIncomplete={isIncomplete}
                    alertMessage="Add at least one trigger integration and complete its configuration to remove this warning."
                    infoMessage="Triggers define where events come from. Add integrations like Slack, GitHub, or Gmail to monitor for new activity."
                />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4 items-stretch">
                {inputs.map((input) => (
                    <Input key={input.id} input={input} inputs={inputs} setInputs={setInputs} handleRemove={handleRemove} agentId={agentId} />
                ))}
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="w-full aspect-square h-auto">
                    <PlusIcon className={cn("size-5", inputs.length > 0 ? "text-primary" : "text-muted-foreground")} />
                </Button>
                <AddTriggerModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSelectIntegration={handleSelectPlatform}
                />
            </div>
        </div>
    )
}

function Input({ input, inputs, setInputs, handleRemove, agentId }: { input: TransientAgentTrigger, inputs: TransientAgentTrigger[], setInputs: (inputs: TransientAgentTrigger[]) => void, handleRemove: (id: string) => void, agentId: string | null }) {
    const isPlaceholder = input.config === undefined;
    const needsConfiguration = !input.config || !input.config.isComplete();
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    const selectorProps: InputConfigSelectorProps = {
        input: input,
        setConfig: (config: ConfigInstance) => setInputs(inputs.map(i => i.id === input.id ? { ...i, config, configType: config.configType } : i)),
        variant: "card",
        agentId: agentId,
    };

    let cardContent;
    if (isPlaceholder) {
        cardContent = (
            <div
                className="w-full aspect-square px-4 pb-4 pt-1 border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors flex flex-col gap-2"
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="flex flex-row justify-between items-center gap-2">
                    <div className="min-w-0 flex-1 text-sm font-medium leading-none truncate">
                        {CONFIG_DETAILS[input.configType].name}
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(input.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="size-16">
                        <IconForConfigType type={input.configType} />
                    </div>
                </div>

                <Badge variant="outline" className="mt-auto self-center max-w-full px-3 py-1 border-yellow-500 text-yellow-600 dark:text-yellow-500 whitespace-normal text-center">
                    <IntegrationSelector {...selectorProps} variant="card" agentId={agentId} />
                </Badge>
            </div>
        );
    } else {
        cardContent = (
            <div
                className="w-full aspect-square px-4 pb-4 pt-2 border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors flex flex-col gap-2"
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="flex flex-row justify-between items-center gap-2">
                    <div className="min-w-0 flex-1 text-sm font-medium leading-none truncate">
                        {CONFIG_DETAILS[input.configType].name}
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(input.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16">
                        <IconForConfigType type={input.configType} />
                    </div>
                </div>

                <Badge variant="outline" className="mt-auto self-center max-w-full px-3 py-1 whitespace-normal text-center">
                    <IntegrationSelector {...selectorProps} variant="card" />
                </Badge>
            </div>
        );
    }

    return (
        <>
            {cardContent}

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{needsConfiguration ? "Configure Integration" : "Integration Details"}</DialogTitle>
                    </DialogHeader>
                    <IntegrationSelector {...selectorProps} variant="dialog" />
                </DialogContent>
            </Dialog>
        </>
    )
}

function OutputLayout({ outputs, setOutputs, isIncomplete, agentId }: { outputs: TransientAgentOutput[], setOutputs: (outputs: TransientAgentOutput[]) => void, isIncomplete: boolean, agentId: string | null }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectOutput = (configType: ConfigType) => {
        const newOutputId = uuidv4();
        const newOutput: TransientAgentOutput = {
            id: newOutputId,
            config: undefined,
            configType: configType,
        };
        const newOutputs = [...outputs, newOutput];
        setOutputs(newOutputs);
        setShowAddModal(false);
    };

    const handleRemove = (id: string) => {
        setOutputs(outputs.filter(output => output.id !== id));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row gap-2 items-center mb-2">
                <SectionHeader>Skills</SectionHeader>
                <SectionInfoIcon
                    isIncomplete={isIncomplete}
                    alertMessage="Select at least one skill destination and complete its configuration to remove this warning."
                    infoMessage="Skills define where the AI will continuously update content. Choose destinations like Notion, Linear, or Slack where updates will be posted."
                />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4 items-stretch">
                {outputs.map((output) => (
                    <OutputCard key={output.id} output={output} outputs={outputs} setOutputs={setOutputs} handleRemove={handleRemove} agentId={agentId} />
                ))}
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="w-full aspect-square h-auto">
                    <PlusIcon className={cn("size-5", outputs.length > 0 ? "text-primary" : "text-muted-foreground")} />
                </Button>
                <AddOutputModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSelectOutput={handleSelectOutput}
                />
            </div>
        </div>
    )
}

function OutputCard({ output, outputs, setOutputs, handleRemove, agentId }: { output: TransientAgentOutput, outputs: TransientAgentOutput[], setOutputs: (outputs: TransientAgentOutput[]) => void, handleRemove: (id: string) => void, agentId: string | null }) {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const isPlaceholder = output.config === undefined;
    const needsConfiguration = !output.config || !output.config.isComplete();

    const selectorProps: InputConfigSelectorProps = {
        input: output,
        setConfig: (config: ConfigInstance) => setOutputs(outputs.map(o => o.id === output.id ? { ...o, config, configType: config.configType } : o)),
        variant: "card",
        agentId: agentId,
    };

    let cardContent;
    if (isPlaceholder) {
        cardContent = (
            <div
                className="w-full aspect-square px-4 pb-4 pt-1 border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors flex flex-col gap-2"
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="flex flex-row justify-between items-center gap-2">
                    <div className="min-w-0 flex-1 text-sm font-medium leading-none truncate">
                        {CONFIG_DETAILS[output.configType].name}
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(output.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="size-16">
                        <IconForConfigType type={output.configType} />
                    </div>
                </div>

                <Badge variant="outline" className="mt-auto self-center max-w-full px-3 py-1 border-yellow-500 text-yellow-600 dark:text-yellow-500 whitespace-normal text-center">
                    <IntegrationSelector {...selectorProps} variant="card" />
                </Badge>
            </div>
        );
    } else {
        cardContent = (
            <div
                className="w-full aspect-square px-4 pb-4 pt-2 border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors flex flex-col gap-2"
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="flex flex-row justify-between items-center gap-2">
                    <div className="min-w-0 flex-1 text-sm font-medium leading-none truncate">
                        {CONFIG_DETAILS[output.configType].name}
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(output.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16">
                        <IconForConfigType type={output.configType} />
                    </div>
                </div>

                <Badge variant="outline" className="mt-auto self-center max-w-full px-3 py-1 whitespace-normal text-center">
                    <IntegrationSelector {...selectorProps} variant="card" agentId={agentId} />
                </Badge>
            </div>
        );
    }

    return (
        <>
            {cardContent}

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{needsConfiguration ? "Configure Skill" : "Skill Details"}</DialogTitle>
                    </DialogHeader>
                    <IntegrationSelector {...selectorProps} variant="dialog" agentId={agentId} />
                </DialogContent>
            </Dialog>
        </>
    )
}

function KnowledgeBaseLayout({ knowledgeBases, setKnowledgeBases, isIncomplete }: { knowledgeBases: TransientKnowledgeBase[], setKnowledgeBases: (knowledgeBases: TransientKnowledgeBase[]) => void, isIncomplete: boolean }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectKnowledgeBase = (configType: ConfigType) => {
        const newKnowledgeBaseId = uuidv4();
        const newKnowledgeBase: TransientKnowledgeBase = {
            id: newKnowledgeBaseId,
            config: undefined,
            configType: configType
        };
        const newKnowledgeBases = [...knowledgeBases, newKnowledgeBase];
        setKnowledgeBases(newKnowledgeBases);
        setShowAddModal(false);
    };

    const handleRemove = (id: string) => {
        setKnowledgeBases(knowledgeBases.filter(kb => kb.id !== id));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-row gap-2 items-center mb-2">
                <SectionHeader>Knowledge Base</SectionHeader>
                <SectionInfoIcon
                    isIncomplete={isIncomplete}
                    alertMessage="Complete knowledge base configuration to remove this warning."
                    infoMessage="Knowledge bases provide context and data for your automation."
                />
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4 items-stretch">
                {knowledgeBases.map((kb) => (
                    <KnowledgeBaseCard key={kb.id} knowledgeBase={kb} knowledgeBases={knowledgeBases} setKnowledgeBases={setKnowledgeBases} handleRemove={handleRemove} />
                ))}
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="w-full aspect-square h-auto">
                    <PlusIcon className={cn("size-5", knowledgeBases.length > 0 ? "text-primary" : "text-muted-foreground")} />
                </Button>
                <AddKnowledgeBaseModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSelectKnowledgeBase={handleSelectKnowledgeBase}
                />
            </div>
        </div>
    )
}

function KnowledgeBaseCard({ knowledgeBase, knowledgeBases, setKnowledgeBases, handleRemove }: { knowledgeBase: TransientKnowledgeBase, knowledgeBases: TransientKnowledgeBase[], setKnowledgeBases: (knowledgeBases: TransientKnowledgeBase[]) => void, handleRemove: (id: string) => void }) {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const isPlaceholder = knowledgeBase.config === undefined;
    const needsConfiguration = !knowledgeBase.config || !knowledgeBase.config.isComplete();

    const selectorProps = {
        knowledgeBase: knowledgeBase,
        setConfig: (config: ConfigInstance) => setKnowledgeBases(knowledgeBases.map(kb => kb.id === knowledgeBase.id ? { ...kb, config, configType: config.configType } : kb)),
        variant: "card" as const,
    };

    let cardContent;
    if (isPlaceholder) {
        cardContent = (
            <div
                className="w-full aspect-square px-4 pb-4 pt-1 border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors flex flex-col gap-2"
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="flex flex-row justify-between items-center gap-2">
                    <div className="min-w-0 flex-1 text-sm font-medium leading-none truncate">
                        {CONFIG_DETAILS[knowledgeBase.configType].name}
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(knowledgeBase.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16">
                        <IconForConfigType type={knowledgeBase.configType} />
                    </div>
                </div>

                <Badge variant="outline" className="mt-auto self-center max-w-full px-3 py-1 border-yellow-500 text-yellow-600 dark:text-yellow-500">
                    <KnowledgeBaseSelector {...selectorProps} variant="card" />
                </Badge>
            </div>
        );
    } else {
        cardContent = (
            <div
                className="w-full aspect-square px-4 pb-4 pt-2 border rounded-lg cursor-pointer hover:bg-accent/30 transition-colors flex flex-col gap-2"
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="flex flex-row justify-between items-center gap-2">
                    <div className="min-w-0 flex-1 text-sm font-medium leading-none truncate">
                        {CONFIG_DETAILS[knowledgeBase.configType].name}
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); handleRemove(knowledgeBase.id); }} className="hover:text-destructive">
                        <XIcon />
                    </Button>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="w-16 h-16">
                        <IconForConfigType type={knowledgeBase.configType} />
                    </div>
                </div>

                <Badge variant="outline" className="mt-auto self-center max-w-full px-3 py-1">
                    <KnowledgeBaseSelector {...selectorProps} variant="card" />
                </Badge>
            </div>
        );
    }

    return (
        <>
            {cardContent}

            <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{needsConfiguration ? "Configure Knowledge Base" : "Knowledge Base Details"}</DialogTitle>
                    </DialogHeader>
                    <KnowledgeBaseSelector {...selectorProps} variant="dialog" />
                </DialogContent>
            </Dialog>
        </>
    )
}
