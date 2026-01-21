import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EditableTextField from '../../../components/ui/EditableTextField';
import { ChannelKnowledgeBase, ChannelNotificationSettings as ChannelNotificationSettingsType, ChannelUpdate, TransientChannelInput, TransientChannelOutput } from "@/shared/types";
import { toast } from "sonner";
import { getDefaultChannelName, toChannelInput, toChannelOutput, toChannelKnowledgeBase } from "@/utility/ChannelUtils";
import { useChannelCount } from "@/hooks/api/useChannelCount";
import { useChannelMutations } from "@/hooks/api/useChannels";
import { type KeyedMutator } from 'swr';
import { Channel, ChannelInput, ChannelOutput, ChannelPrompt, TransientKnowledgeBase } from "@/shared/types";
import { AddInputModal } from "../components/AddInputModal";
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
import ChannelNotificationSettings from "../ChannelNotificationSettings";
import ChannelApprovalSettings from "../ChannelApprovalSettings";
import { InstructionsEditor } from "../components/InstructionsEditor";
import { Tooltip, TooltipTrigger, TooltipContent } from "../../../components/ui/tooltip";
import { IconForConfigType } from "../components/Integration";
import { AppsList } from "../../../components/Channels";

export type ChannelSetupTabProps = {
    channelId: string | null;
    name: string | null;
    setName: (name: string) => void;
    inputs: TransientChannelInput[];
    setInputs: (inputs: TransientChannelInput[]) => void;
    outputs: TransientChannelOutput[];
    setOutputs: (outputs: TransientChannelOutput[]) => void;
    knowledgeBases: TransientKnowledgeBase[];
    setKnowledgeBases: (knowledgeBases: TransientKnowledgeBase[]) => void;
    prompt: ChannelPrompt | undefined;
    setPrompt: (prompt: ChannelPrompt | undefined) => void;
    isActive: boolean;
    setIsActive: (isActive: boolean) => void;
    toolApprovalSettings: Array<{ toolName: string; requiresApproval: boolean }>;
    setToolApprovalSettings: (settings: Array<{ toolName: string; requiresApproval: boolean }>) => void;
    notificationSettings: ChannelNotificationSettingsType;
    setNotificationSettings: (settings: ChannelNotificationSettingsType) => void;
    isLoading: boolean;
    mutate: KeyedMutator<Channel>;
    updatedAt?: string;
};

function SaveChannelButton({
    defaultName,
    channelId,
    name,
    inputs,
    outputs,
    knowledgeBases,
    prompt,
    isActive,
    toolApprovalSettings,
    notificationSettings,
    mutate,
    onSaveSuccess
}: {
    defaultName: string;
    channelId: string | null;
    name: string | null;
    inputs: ChannelInput[];
    outputs: ChannelOutput[];
    knowledgeBases: ChannelKnowledgeBase[];
    prompt: ChannelPrompt | undefined;
    isActive: boolean;
    toolApprovalSettings: Array<{ toolName: string; requiresApproval: boolean }>;
    notificationSettings: ChannelNotificationSettingsType;
    mutate: KeyedMutator<Channel>;
    onSaveSuccess?: () => void;
}) {
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const { createChannel, updateChannel } = useChannelMutations();

    // Validation: all required fields must be present
    // Each integration reports its own completeness
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => i != null && i.config != null && i.config.isComplete()) &&
        outputs.length > 0 &&
        outputs.every(o => o != null && o.config != null && o.config.isComplete()) &&
        !!prompt?.text; // Ensure prompt is not empty

    const isEditMode = !!channelId;

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !outputs.length) return;

        setIsSaving(true);
        try {
            const channelData: ChannelUpdate = {
                name: name || defaultName || '',
                inputs,
                outputs,
                knowledgeBases,
                prompt,
                isActive,
                toolApprovalSettings,
                notificationSettings
            };

            if (isEditMode) {
                // Update existing channel
                await updateChannel({
                    id: channelId!,
                    data: channelData,
                    mutateChannel: mutate,
                });
            } else if (isComplete && channelData.outputs && channelData.outputs.length > 0 && channelData.inputs && channelData.inputs.length > 0) {
                // Create new channel
                const creation = await createChannel(channelData);

                if (creation?.id) {
                    navigate(`/app/channels/${creation.id}`, { replace: true });
                }
            }

            toast.success('Channel saved successfully');

            // Notify parent that save was successful
            onSaveSuccess?.();

            setSaveSuccess(true);
            setTimeout(() => {
                setSaveSuccess(false);
            }, 1000);
        } catch (error) {
            console.error('Error saving channel:', error);
            alert('Failed to save channel. Please try again.');
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

export default function ChannelSetupTab({
    channelId,
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
    toolApprovalSettings,
    setToolApprovalSettings,
    notificationSettings,
    setNotificationSettings,
    mutate,
}: ChannelSetupTabProps) {
    const { totalCount } = useChannelCount();
    const defaultName = getDefaultChannelName(totalCount);

    const channelInputs = inputs.map(toChannelInput).filter((i): i is ChannelInput => i != null);
    const channelOutputs = outputs.map(toChannelOutput).filter((o): o is ChannelOutput => o != null);
    const channelKnowledgeBases = knowledgeBases.map(toChannelKnowledgeBase).filter((kb): kb is ChannelKnowledgeBase => kb != null);

    type SetupSection = 'triggers' | 'knowledgeBase' | 'prompt' | 'skills' | 'alerts';
    const [activeSection, setActiveSection] = useState<SetupSection>('triggers');

    const triggersIncomplete =
        inputs.length === 0 || inputs.some((i) => !i || !i.config || !i.config.isComplete());
    const knowledgeBaseIncomplete = knowledgeBases.some((kb) => !kb || !kb.config || !kb.config.isComplete());
    const promptIncomplete = !prompt?.text || prompt.text.trim() === '';
    const skillsIncomplete = outputs.length === 0 || outputs.some((o) => !o || !o.config || !o.config.isComplete());

    // Check if automation is complete (same logic as SaveChannelButton)
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => i != null && i.config != null && i.config.isComplete()) &&
        outputs.length > 0 &&
        outputs.every(o => o != null && o.config != null && o.config.isComplete()) &&
        !!prompt?.text;

    // Create a minimal channel-like object for AppsList
    // Only create if we have outputs (required by Channel type)
    const channelForAppsList = channelOutputs.length > 0 ? {
        id: channelId || '',
        name: name || defaultName || '',
        isActive,
        prompt: prompt || { text: '' },
        inputs: channelInputs,
        outputs: channelOutputs,
        knowledgeBases: channelKnowledgeBases,
        notificationSettings,
    } : null;

    return (
        <div className="flex flex-col h-full min-h-0 gap-0">
            <div className="py-6">
                <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="flex justify-start min-w-0 pl-2">
                        <SaveChannelButton
                            defaultName={defaultName}
                            channelId={channelId}
                            name={name}
                            inputs={channelInputs}
                            outputs={channelOutputs}
                            knowledgeBases={channelKnowledgeBases}
                            prompt={prompt}
                            isActive={isActive}
                            toolApprovalSettings={toolApprovalSettings}
                            notificationSettings={notificationSettings}
                            mutate={mutate}
                        />
                    </div>
                    <div className="flex justify-center items-center min-w-0">
                        <EditableTextField className="text-center max-w-fit" value={name || ''} placeholder={defaultName} onSave={(value) => setName(value)} />
                    </div>
                    <div className="flex justify-end min-w-0 items-center gap-3 px-2">
                        {isComplete && channelForAppsList ? (
                            <>
                                <AppsList channel={channelForAppsList} />
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
                                <InputLayout inputs={inputs} setInputs={setInputs} isIncomplete={triggersIncomplete} />
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
                                        channelInputs={channelInputs}
                                        channelOutputs={channelOutputs}
                                        knowledgeBases={channelKnowledgeBases}
                                        isIncomplete={promptIncomplete}
                                    />
                                </div>
                            </div>
                        )}

                        {activeSection === 'skills' && (
                            <div className="max-w-3xl flex flex-col gap-4 pr-6">
                                <OutputLayout outputs={outputs} setOutputs={setOutputs} isIncomplete={skillsIncomplete} />
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
                                <ChannelApprovalSettings 
                                    outputs={outputs} 
                                    toolApprovalSettings={toolApprovalSettings || []} 
                                    onChange={setToolApprovalSettings} 
                                />
                                <ChannelNotificationSettings settings={notificationSettings} onChange={setNotificationSettings} />
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

function InputLayout({ inputs, setInputs, isIncomplete }: { inputs: TransientChannelInput[], setInputs: (inputs: TransientChannelInput[]) => void, isIncomplete: boolean }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectPlatform = (config: ConfigType) => {
        const newInputId = uuidv4(); // We need to mint a placeholder ID for the new input so that we can identify it later.
        const newInput: TransientChannelInput = { id: newInputId, config: undefined, configType: config };
        const newInputs: TransientChannelInput[] = [...inputs, newInput];
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
                    <Input key={input.id} input={input} inputs={inputs} setInputs={setInputs} handleRemove={handleRemove} />
                ))}
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="w-full aspect-square h-auto">
                    <PlusIcon className={cn("size-5", inputs.length > 0 ? "text-primary" : "text-muted-foreground")} />
                </Button>
                <AddInputModal
                    isOpen={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onSelectIntegration={handleSelectPlatform}
                />
            </div>
        </div>
    )
}

function Input({ input, inputs, setInputs, handleRemove }: { input: TransientChannelInput, inputs: TransientChannelInput[], setInputs: (inputs: TransientChannelInput[]) => void, handleRemove: (id: string) => void }) {
    const isPlaceholder = input.config === undefined;
    const needsConfiguration = !input.config || !input.config.isComplete();
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    console.log("input", input);

    const selectorProps: InputConfigSelectorProps = {
        input: input,
        setConfig: (config: ConfigInstance) => setInputs(inputs.map(i => i.id === input.id ? { ...i, config, configType: config.configType } : i)),
        variant: "card",
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

function OutputLayout({ outputs, setOutputs, isIncomplete }: { outputs: TransientChannelOutput[], setOutputs: (outputs: TransientChannelOutput[]) => void, isIncomplete: boolean }) {
    const [showAddModal, setShowAddModal] = useState(false);

    const handleSelectOutput = (configType: ConfigType) => {
        const newOutputId = uuidv4();
        const newOutput: TransientChannelOutput = {
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
                    <OutputCard key={output.id} output={output} outputs={outputs} setOutputs={setOutputs} handleRemove={handleRemove} />
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

function OutputCard({ output, outputs, setOutputs, handleRemove }: { output: TransientChannelOutput, outputs: TransientChannelOutput[], setOutputs: (outputs: TransientChannelOutput[]) => void, handleRemove: (id: string) => void }) {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const isPlaceholder = output.config === undefined;
    const needsConfiguration = !output.config || !output.config.isComplete();

    const selectorProps: InputConfigSelectorProps = {
        input: output,
        setConfig: (config: ConfigInstance) => setOutputs(outputs.map(o => o.id === output.id ? { ...o, config, configType: config.configType } : o)),
        variant: "card",
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
                        <DialogTitle>{needsConfiguration ? "Configure Skill" : "Skill Details"}</DialogTitle>
                    </DialogHeader>
                    <IntegrationSelector {...selectorProps} variant="dialog" />
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
