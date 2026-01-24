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
import { PlusIcon, XIcon, Zap, FileText, Wrench, Bell, Database, ChevronRight, Check } from "lucide-react";
import { cn } from "../../../lib/utils";
import { Badge } from "../../../components/ui/badge";
import AgentNotificationSettings from "../AgentNotificationSettings";
import AgentApprovalSettings from "../AgentApprovalSettings";
import { InstructionsEditor } from "../components/InstructionsEditor";
import { IconForConfigType } from "../components/Integration";

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
    setRequireApproval,
    notificationSettings,
    setNotificationSettings,
    mutate,
}: AgentSetupTabProps) {
    const { totalCount } = useAgentCount();
    const defaultName = getDefaultAgentName(totalCount);

    const agentInputs = inputs.map(toAgentTrigger).filter((i): i is AgentTrigger => i != null);
    const agentOutputs = outputs.map(toAgentOutput).filter((o): o is AgentOutput => o != null);
    const agentKnowledgeBases = knowledgeBases.map(toAgentKnowledgeBase).filter((kb): kb is AgentKnowledgeBase => kb != null);

    const triggersIncomplete =
        inputs.length === 0 || inputs.some((i) => !i || !i.config || !i.config.isComplete());
    const promptIncomplete = !prompt?.text || prompt.text.trim() === '';
    const skillsIncomplete = outputs.length === 0 || outputs.some((o) => !o || !o.config || !o.config.isComplete());

    // Step definitions for the builder flow
    const steps = [
        {
            id: 'triggers' as const,
            label: 'Triggers',
            description: 'What starts this agent',
            icon: Zap,
            isComplete: !triggersIncomplete,
            count: inputs.length,
        },
        {
            id: 'prompt' as const,
            label: 'Instructions',
            description: 'What the agent does',
            icon: FileText,
            isComplete: !promptIncomplete,
        },
        {
            id: 'skills' as const,
            label: 'Skills',
            description: 'What the agent can use',
            icon: Wrench,
            isComplete: !skillsIncomplete,
            count: outputs.length,
        },
    ];

    type SetupSection = 'triggers' | 'knowledgeBase' | 'prompt' | 'skills' | 'alerts';
    const [activeSection, setActiveSection] = useState<SetupSection>('triggers');

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="border-b border-border px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                        <EditableTextField
                            className="text-lg font-medium"
                            value={name || ''}
                            placeholder={defaultName}
                            onSave={(value) => setName(value)}
                        />
                    </div>
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
                        notificationSettings={notificationSettings}
                        mutate={mutate}
                    />
                </div>
            </div>

            {/* Builder Steps - Horizontal flow */}
            <div className="border-b border-border px-6 py-4 bg-muted/30">
                <div className="flex items-center gap-2">
                    {steps.map((step, index) => {
                        const isActive = activeSection === step.id;
                        const StepIcon = step.icon;

                        return (
                            <div key={step.id} className="flex items-center">
                                <button
                                    onClick={() => setActiveSection(step.id)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all",
                                        isActive
                                            ? "bg-background border border-border shadow-sm"
                                            : "hover:bg-background/50",
                                    )}
                                >
                                    <div className={cn(
                                        "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                                        step.isComplete
                                            ? "bg-foreground text-background"
                                            : isActive
                                                ? "bg-foreground/10 text-foreground border border-foreground/20"
                                                : "bg-muted text-muted-foreground"
                                    )}>
                                        {step.isComplete ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <StepIcon className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div className="text-left">
                                        <div className={cn(
                                            "text-sm font-medium",
                                            isActive ? "text-foreground" : "text-muted-foreground"
                                        )}>
                                            {step.label}
                                            {step.count !== undefined && step.count > 0 && (
                                                <span className="ml-1.5 text-xs text-muted-foreground">({step.count})</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted-foreground">{step.description}</div>
                                    </div>
                                </button>
                                {index < steps.length - 1 && (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 mx-1" />
                                )}
                            </div>
                        );
                    })}

                    {/* Separator */}
                    <div className="w-px h-8 bg-border mx-2" />

                    {/* Optional sections */}
                    <button
                        onClick={() => setActiveSection('knowledgeBase')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                            activeSection === 'knowledgeBase'
                                ? "bg-background border border-border shadow-sm text-foreground"
                                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                        )}
                    >
                        <Database className="w-4 h-4" />
                        <span>Knowledge</span>
                        {knowledgeBases.length > 0 && (
                            <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                                {knowledgeBases.length}
                            </Badge>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveSection('alerts')}
                        className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all",
                            activeSection === 'alerts'
                                ? "bg-background border border-border shadow-sm text-foreground"
                                : "text-muted-foreground hover:bg-background/50 hover:text-foreground",
                        )}
                    >
                        <Bell className="w-4 h-4" />
                        <span>Alerts</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-6">
                    {activeSection === 'triggers' && (
                        <div className="max-w-3xl">
                            <InputLayout inputs={inputs} setInputs={setInputs} isIncomplete={triggersIncomplete} />
                        </div>
                    )}

                    {activeSection === 'knowledgeBase' && (
                        <div className="max-w-3xl">
                            <KnowledgeBaseLayout knowledgeBases={knowledgeBases} setKnowledgeBases={setKnowledgeBases} />
                        </div>
                    )}

                    {activeSection === 'prompt' && (
                        <div className="max-w-4xl">
                            <div className="h-[calc(100vh-16rem)] min-h-[420px]">
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
                        <div className="max-w-3xl">
                            <OutputLayout outputs={outputs} setOutputs={setOutputs} isIncomplete={skillsIncomplete} />
                        </div>
                    )}

                    {activeSection === 'alerts' && (
                        <div className="max-w-2xl space-y-6">
                            <div>
                                <h2 className="text-lg font-medium mb-1">Alerts & Approval</h2>
                                <p className="text-sm text-muted-foreground mb-4">
                                    Configure when you want to be notified and whether actions need your approval.
                                </p>
                            </div>
                            <AgentApprovalSettings requireApproval={requireApproval} onChange={setRequireApproval} />
                            <AgentNotificationSettings settings={notificationSettings} onChange={setNotificationSettings} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function InputLayout({ inputs, setInputs }: { inputs: TransientAgentTrigger[], setInputs: (inputs: TransientAgentTrigger[]) => void, isIncomplete: boolean }) {
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
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-medium mb-1">Triggers</h2>
                <p className="text-sm text-muted-foreground">
                    Events that will activate this agent. Add integrations like Slack, GitHub, or Gmail to listen for activity.
                </p>
            </div>

            <div className="space-y-2">
                {inputs.map((input) => (
                    <InputCard key={input.id} input={input} inputs={inputs} setInputs={setInputs} handleRemove={handleRemove} />
                ))}
                <Button
                    variant="outline"
                    onClick={() => setShowAddModal(true)}
                    className="w-full h-14 border-dashed hover:border-solid hover:bg-muted/50"
                >
                    <PlusIcon className="size-4 mr-2" />
                    Add trigger
                </Button>
            </div>

            <AddTriggerModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectIntegration={handleSelectPlatform}
            />
        </div>
    )
}

function InputCard({ input, inputs, setInputs, handleRemove }: { input: TransientAgentTrigger, inputs: TransientAgentTrigger[], setInputs: (inputs: TransientAgentTrigger[]) => void, handleRemove: (id: string) => void }) {
    const needsConfiguration = !input.config || !input.config.isComplete();
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);

    const selectorProps: InputConfigSelectorProps = {
        input: input,
        setConfig: (config: ConfigInstance) => setInputs(inputs.map(i => i.id === input.id ? { ...i, config, configType: config.configType } : i)),
        variant: "card",
    };

    return (
        <>
            <div
                className={cn(
                    "flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
                    needsConfiguration && "border-yellow-500/50"
                )}
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="w-10 h-10 shrink-0">
                    <IconForConfigType type={input.configType} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                        {CONFIG_DETAILS[input.configType].name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                        <IntegrationSelector {...selectorProps} variant="card" />
                    </div>
                </div>
                {needsConfiguration && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500 shrink-0">
                        Configure
                    </Badge>
                )}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); handleRemove(input.id); }}
                    className="shrink-0 hover:text-destructive"
                >
                    <XIcon className="w-4 h-4" />
                </Button>
            </div>

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

function OutputLayout({ outputs, setOutputs }: { outputs: TransientAgentOutput[], setOutputs: (outputs: TransientAgentOutput[]) => void, isIncomplete: boolean }) {
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
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-medium mb-1">Skills</h2>
                <p className="text-sm text-muted-foreground">
                    Tools and integrations the agent can use to take action. Add skills like GitHub, Linear, or Slack.
                </p>
            </div>

            <div className="space-y-2">
                {outputs.map((output) => (
                    <SkillCard key={output.id} output={output} outputs={outputs} setOutputs={setOutputs} handleRemove={handleRemove} />
                ))}
                <Button
                    variant="outline"
                    onClick={() => setShowAddModal(true)}
                    className="w-full h-14 border-dashed hover:border-solid hover:bg-muted/50"
                >
                    <PlusIcon className="size-4 mr-2" />
                    Add skill
                </Button>
            </div>

            <AddOutputModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectOutput={handleSelectOutput}
            />
        </div>
    )
}

function SkillCard({ output, outputs, setOutputs, handleRemove }: { output: TransientAgentOutput, outputs: TransientAgentOutput[], setOutputs: (outputs: TransientAgentOutput[]) => void, handleRemove: (id: string) => void }) {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const needsConfiguration = !output.config || !output.config.isComplete();

    const selectorProps: InputConfigSelectorProps = {
        input: output,
        setConfig: (config: ConfigInstance) => setOutputs(outputs.map(o => o.id === output.id ? { ...o, config, configType: config.configType } : o)),
        variant: "card",
    };

    return (
        <>
            <div
                className={cn(
                    "flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
                    needsConfiguration && "border-yellow-500/50"
                )}
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="w-10 h-10 shrink-0">
                    <IconForConfigType type={output.configType} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                        {CONFIG_DETAILS[output.configType].name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                        <IntegrationSelector {...selectorProps} variant="card" />
                    </div>
                </div>
                {needsConfiguration && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500 shrink-0">
                        Configure
                    </Badge>
                )}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); handleRemove(output.id); }}
                    className="shrink-0 hover:text-destructive"
                >
                    <XIcon className="w-4 h-4" />
                </Button>
            </div>

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

function KnowledgeBaseLayout({ knowledgeBases, setKnowledgeBases }: { knowledgeBases: TransientKnowledgeBase[], setKnowledgeBases: (knowledgeBases: TransientKnowledgeBase[]) => void }) {
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
            {knowledgeBases.map((kb) => (
                <KnowledgeBaseCard key={kb.id} knowledgeBase={kb} knowledgeBases={knowledgeBases} setKnowledgeBases={setKnowledgeBases} handleRemove={handleRemove} />
            ))}
            <Button
                variant="outline"
                onClick={() => setShowAddModal(true)}
                className="w-full justify-center border-dashed py-3"
            >
                <PlusIcon className="w-4 h-4 mr-2" />
                Add knowledge base
            </Button>
            <AddKnowledgeBaseModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSelectKnowledgeBase={handleSelectKnowledgeBase}
            />
        </div>
    )
}

function KnowledgeBaseCard({ knowledgeBase, knowledgeBases, setKnowledgeBases, handleRemove }: { knowledgeBase: TransientKnowledgeBase, knowledgeBases: TransientKnowledgeBase[], setKnowledgeBases: (knowledgeBases: TransientKnowledgeBase[]) => void, handleRemove: (id: string) => void }) {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false);
    const needsConfiguration = !knowledgeBase.config || !knowledgeBase.config.isComplete();

    const selectorProps = {
        knowledgeBase: knowledgeBase,
        setConfig: (config: ConfigInstance) => setKnowledgeBases(knowledgeBases.map(kb => kb.id === knowledgeBase.id ? { ...kb, config, configType: config.configType } : kb)),
        variant: "card" as const,
    };

    return (
        <>
            <div
                className={cn(
                    "flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50",
                    needsConfiguration && "border-yellow-500/50"
                )}
                onClick={() => setShowDetailsDialog(true)}
            >
                <div className="w-10 h-10 shrink-0">
                    <IconForConfigType type={knowledgeBase.configType} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{CONFIG_DETAILS[knowledgeBase.configType].name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                        <KnowledgeBaseSelector {...selectorProps} variant="card" />
                    </div>
                </div>
                {needsConfiguration && (
                    <Badge variant="outline" className="border-yellow-500 text-yellow-600 dark:text-yellow-500 shrink-0">
                        Configure
                    </Badge>
                )}
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => { e.stopPropagation(); handleRemove(knowledgeBase.id); }}
                    className="hover:text-destructive shrink-0"
                >
                    <XIcon className="w-4 h-4" />
                </Button>
            </div>

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
