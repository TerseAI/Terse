import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { Bell, Check, ChevronRight, Copy, FileText, MoreVertical, Pause, Play, PlusIcon, Trash2, Wrench, XIcon, Zap } from "lucide-react"
import { toast } from "sonner"
import { type KeyedMutator } from "swr"
import { v4 as uuidv4 } from "uuid"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAgentCount } from "@/hooks/api/useAgentCount"
import { useAgentMutations } from "@/hooks/api/useAgents"
import { useBuilderSession } from "@/hooks/useBuilderSession"
import { FROM_SETUP_CHAT_PARAM } from "@/shared/FrontendRoutes"
import { FrontendRoutes } from "@/shared/FrontendRoutes"
import { AgentNotificationSettings as AgentNotificationSettingsType, AgentUpdate, TransientAgentOutput, TransientAgentTrigger } from "@/shared/types"
import { Agent, AgentOutput, AgentPrompt, AgentTrigger } from "@/shared/types"
import { getDefaultAgentName, toAgentOutput, toAgentTrigger } from "@/utility/AgentUtils"

import { InputConfigSelectorProps, IntegrationSelector } from "../../../components/IntegrationSelector"
import EditableTextField from "../../../components/ui/EditableTextField"
import { Badge } from "../../../components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog"
import { cn } from "../../../lib/utils"
import { useModelContext } from "../../../services/ModelContextProvider"
import { CONFIG_DETAILS, ConfigInstance, ConfigType } from "../../../shared/Configs"
import { AgentSetUpPageContext } from "../../../utility/AgentModelDonation"
import AgentApprovalSettings from "../AgentApprovalSettings"
import AgentNotificationSettings from "../AgentNotificationSettings"
import { AddOutputModal } from "../components/AddOutputModal"
import { AddTriggerModal } from "../components/AddTriggerModal"
import { InstructionsEditor } from "../components/InstructionsEditor"
import { IconForConfigType } from "../components/Integration"

export type SetupSection = "triggers" | "prompt" | "skills" | "alerts"
export type AgentSetupTabProps = {
    agentId: string | null
    name: string | null
    setName: (name: string) => void
    inputs: TransientAgentTrigger[]
    setInputs: (inputs: TransientAgentTrigger[]) => void
    outputs: TransientAgentOutput[]
    setOutputs: (outputs: TransientAgentOutput[]) => void
    prompt: AgentPrompt | undefined
    setPrompt: (prompt: AgentPrompt | undefined) => void
    isActive: boolean
    setIsActive: (isActive: boolean) => void
    requireApproval: boolean
    setRequireApproval: (requireApproval: boolean) => void
    toolApprovals: string[]
    setToolApprovals: (toolApprovals: string[]) => void
    notificationSettings: AgentNotificationSettingsType
    setNotificationSettings: (settings: AgentNotificationSettingsType) => void
    isLoading: boolean
    mutate: KeyedMutator<Agent>
    updatedAt?: string
}

function DeleteAgentDialog({ isOpen, onClose, onConfirm, agentName, isDeleting }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; agentName: string; isDeleting: boolean }) {
    return (
        <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete Agent</DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete <span className="font-semibold">{agentName}</span>? This action cannot be undone and will remove all associated run history.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isDeleting}>
                        Cancel
                    </Button>
                    <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
                        {isDeleting ? "Deleting..." : "Delete Agent"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function AgentOptionsMenu({
    agentId,
    agentName,
    isActive,
    onToggleActive,
    mutate,
    inputs,
    outputs,
    prompt,
    requireApproval,
    toolApprovals,
    notificationSettings
}: {
    agentId: string | null
    agentName: string
    isActive: boolean
    onToggleActive: (active: boolean) => void
    mutate: KeyedMutator<Agent>
    inputs: AgentTrigger[]
    outputs: AgentOutput[]
    prompt: AgentPrompt | undefined
    requireApproval: boolean
    toolApprovals: string[]
    notificationSettings: AgentNotificationSettingsType
}) {
    const navigate = useNavigate()
    const { deleteAgent, updateAgent, createAgent } = useAgentMutations()
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [isCloning, setIsCloning] = useState(false)

    // Only show menu for existing agents
    if (!agentId) {
        return null
    }

    const handleToggleActive = async () => {
        try {
            await updateAgent({
                id: agentId,
                data: { isActive: !isActive },
                mutateAgent: mutate
            })
            onToggleActive(!isActive)
            toast.success(isActive ? "Agent paused" : "Agent resumed")
        } catch (error) {
            console.error("Failed to toggle agent status:", error)
            toast.error("Failed to update agent status")
        }
    }

    const handleClone = async () => {
        setIsCloning(true)
        try {
            const clonedAgentData: AgentUpdate = {
                name: `${agentName} (copy)`,
                triggers: inputs,
                outputs,
                prompt,
                isActive: false,
                requireApproval,
                toolApprovals,
                notificationSettings
            }

            const result = await createAgent(clonedAgentData)

            if (result?.id) {
                toast.success("Agent cloned successfully")
                navigate(FrontendRoutes.AGENTS.DETAIL(result.id))
            } else {
                toast.error("Failed to clone agent: no ID returned")
            }
        } catch (error) {
            console.error("Failed to clone agent:", error)
            toast.error("Failed to clone agent")
        } finally {
            setIsCloning(false)
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteAgent(agentId)
            toast.success("Agent deleted")
            navigate(FrontendRoutes.AGENTS.SETUP)
        } catch (error) {
            console.error("Failed to delete agent:", error)
            toast.error("Failed to delete agent")
        } finally {
            setIsDeleting(false)
            setShowDeleteDialog(false)
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleClone} disabled={isCloning}>
                        <Copy className="h-4 w-4" />
                        {isCloning ? "Cloning..." : "Clone Agent"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleToggleActive}>
                        {isActive ? (
                            <>
                                <Pause className="h-4 w-4" />
                                Pause Agent
                            </>
                        ) : (
                            <>
                                <Play className="h-4 w-4" />
                                Resume Agent
                            </>
                        )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                        <Trash2 className="h-4 w-4" />
                        Delete Agent
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <DeleteAgentDialog isOpen={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} onConfirm={handleDelete} agentName={agentName} isDeleting={isDeleting} />
        </>
    )
}

function SaveAgentButton({
    defaultName,
    agentId,
    name,
    inputs,
    outputs,
    prompt,
    isActive,
    requireApproval,
    toolApprovals,
    notificationSettings,
    mutate,
    onSaveSuccess
}: {
    defaultName: string
    agentId: string | null
    name: string | null
    inputs: AgentTrigger[]
    outputs: AgentOutput[]
    prompt: AgentPrompt | undefined
    isActive: boolean
    requireApproval: boolean
    toolApprovals: string[]
    notificationSettings: AgentNotificationSettingsType
    mutate: KeyedMutator<Agent>
    onSaveSuccess?: () => void
}) {
    const navigate = useNavigate()
    const [isSaving, setIsSaving] = useState(false)
    const [saveSuccess, setSaveSuccess] = useState(false)
    const { createAgent, updateAgent } = useAgentMutations()

    // Validation: all required fields must be present
    // Each integration reports its own completeness
    const isComplete =
        inputs.length > 0 &&
        inputs.every(i => i != null && i.config != null && i.config.isComplete()) &&
        outputs.length > 0 &&
        outputs.every(o => o != null && o.config != null && o.config.isComplete()) &&
        !!prompt?.text // Ensure prompt is not empty

    const isEditMode = !!agentId

    const handleSave = async () => {
        if (!isComplete || !inputs.length || !outputs.length) return

        setIsSaving(true)
        try {
            const agentData: AgentUpdate = {
                name: name || defaultName || "",
                triggers: inputs,
                outputs,
                prompt,
                isActive,
                requireApproval,
                toolApprovals,
                notificationSettings
            }

            if (isEditMode) {
                // Update existing agent
                await updateAgent({
                    id: agentId!,
                    data: agentData,
                    mutateAgent: mutate
                })
            } else if (isComplete && agentData.outputs && agentData.outputs.length > 0 && agentData.triggers && agentData.triggers.length > 0) {
                // Create new agent
                const creation = await createAgent(agentData)

                if (creation?.id) {
                    navigate(FrontendRoutes.AGENTS.DETAIL(creation.id), { replace: true })
                }
            }

            toast.success("Agent saved successfully")

            // Notify parent that save was successful
            onSaveSuccess?.()

            setSaveSuccess(true)
            setTimeout(() => {
                setSaveSuccess(false)
            }, 1000)
        } catch (error) {
            console.error("Error saving agent:", error)
            alert("Failed to save agent. Please try again.")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Button onClick={handleSave} disabled={!isComplete || isSaving} className="min-w-24 w-fit">
            {isSaving ? "Saving..." : saveSuccess ? "Saved!" : isComplete ? "Save" : "Complete All Steps"}
        </Button>
    )
}

export default function AgentSetupTab({
    agentId,
    name,
    setName,
    inputs,
    outputs,
    prompt,
    setInputs,
    setOutputs,
    setPrompt,
    isActive,
    setIsActive,
    requireApproval,
    setRequireApproval: _setRequireApproval, // Kept for backward compatibility but not used (we use toolApprovals instead)
    notificationSettings,
    setNotificationSettings,
    toolApprovals,
    setToolApprovals,
    mutate
}: AgentSetupTabProps) {
    const { totalCount } = useAgentCount()
    const { clearSessionId } = useBuilderSession()
    const [searchParams, setSearchParams] = useSearchParams()
    const defaultName = getDefaultAgentName(totalCount)
    void _setRequireApproval

    // Clear setup session when landing on agent page
    useEffect(() => {
        if (searchParams.has(FROM_SETUP_CHAT_PARAM)) {
            searchParams.delete(FROM_SETUP_CHAT_PARAM)
            setSearchParams(searchParams, { replace: true })
            clearSessionId()
        }
    }, [searchParams, setSearchParams, clearSessionId])
    const { donate } = useModelContext()

    const agentInputs = inputs.map(toAgentTrigger).filter((i): i is AgentTrigger => i != null)
    const agentOutputs = outputs.map(toAgentOutput).filter((o): o is AgentOutput => o != null)

    const triggersIncomplete = inputs.length === 0 || inputs.some(i => !i || !i.config || !i.config.isComplete())
    const promptIncomplete = !prompt?.text || prompt.text.trim() === ""
    const skillsIncomplete = outputs.length === 0 || outputs.some(o => !o || !o.config || !o.config.isComplete())

    // Step definitions for the builder flow
    const steps = [
        {
            id: "triggers" as const,
            label: "Triggers",
            subheader: "What starts this agent",
            icon: Zap,
            isComplete: !triggersIncomplete,
            count: inputs.length
        },
        {
            id: "prompt" as const,
            label: "Instructions",
            subheader: "What the agent does",
            icon: FileText,
            isComplete: !promptIncomplete
        },
        {
            id: "skills" as const,
            label: "Skills",
            subheader: "What the agent can use",
            icon: Wrench,
            isComplete: !skillsIncomplete,
            count: outputs.length
        }
    ]
    const [activeSection, setActiveSection] = useState<SetupSection>("triggers")

    donate("Agent Set Up Page Context", new AgentSetUpPageContext(activeSection))

    return (
        <div className="grid grid-cols-20 @container/agent-setup">
            <div className="flex flex-col col-span-20">
                {/* Header */}
                <div className="border-b border-border px-6 py-4">
                    <div className="flex w-full flex-col gap-3 @xl/agent-setup:flex-row @xl/agent-setup:items-center @xl/agent-setup:justify-between">
                        <div className="flex flex-1 items-center gap-3 min-w-0">
                            <EditableTextField className="text-lg font-medium" value={name || ""} placeholder={defaultName} onSave={value => setName(value)} />
                            {agentId && !isActive && (
                                <Badge variant="outline" className="text-muted-foreground">
                                    <Pause className="h-3 w-3 mr-1" />
                                    Paused
                                </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <SaveAgentButton
                                defaultName={defaultName}
                                agentId={agentId}
                                name={name}
                                inputs={agentInputs}
                                outputs={agentOutputs}
                                prompt={prompt}
                                isActive={isActive}
                                requireApproval={requireApproval}
                                toolApprovals={toolApprovals}
                                notificationSettings={notificationSettings}
                                mutate={mutate}
                            />
                            <AgentOptionsMenu
                                agentId={agentId}
                                agentName={name || defaultName}
                                isActive={isActive}
                                onToggleActive={setIsActive}
                                mutate={mutate}
                                inputs={agentInputs}
                                outputs={agentOutputs}
                                prompt={prompt}
                                requireApproval={requireApproval}
                                toolApprovals={toolApprovals}
                                notificationSettings={notificationSettings}
                            />
                        </div>
                    </div>
                </div>

                {/* Builder Steps - Horizontal flow */}
                <div className="border-b border-border px-6 py-4 bg-muted/30">
                    <div className="flex w-full max-w-7xl flex-col gap-2 @xl/agent-setup:flex-row @xl/agent-setup:flex-wrap @xl/agent-setup:items-center @[50rem]/agent-setup:flex-nowrap">
                        {steps.map((step, index) => {
                            const isActive = activeSection === step.id
                            const StepIcon = step.icon

                            return (
                                <div key={step.id} className="flex items-center w-full @xl/agent-setup:flex-1 @xl/agent-setup:min-w-0">
                                    <button
                                        onClick={() => setActiveSection(step.id)}
                                        className={cn(
                                            "flex w-full items-center justify-start gap-3 rounded-lg border px-4 py-2.5 text-left transition-colors",
                                            isActive ? "bg-background border-border shadow-sm" : "border-transparent hover:bg-background/50"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                                                step.isComplete
                                                    ? "bg-foreground text-background"
                                                    : isActive
                                                      ? "bg-foreground/10 text-foreground border border-foreground/20"
                                                      : "bg-muted text-muted-foreground"
                                            )}
                                        >
                                            {step.isComplete ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                                                {step.label}
                                                {step.count !== undefined && step.count > 0 && <span className="ml-1.5 text-xs text-muted-foreground">({step.count})</span>}
                                            </div>
                                            <div className="text-xs leading-snug text-muted-foreground whitespace-normal">{step.subheader}</div>
                                        </div>
                                    </button>
                                    {index < steps.length - 1 && <ChevronRight className="hidden @xl/agent-setup:block w-4 h-4 text-muted-foreground/50 mx-1" />}
                                </div>
                            )
                        })}

                        <div className="flex w-auto items-center gap-2 self-start @xl/agent-setup:shrink-0 @xl/agent-setup:basis-full @[50rem]/agent-setup:basis-auto @[50rem]/agent-setup:self-center">
                            {/* Separator */}
                            <div className="hidden @[50rem]/agent-setup:block w-px h-8 bg-border mx-1" />

                            {/* Optional sections */}
                            <button
                                onClick={() => setActiveSection("alerts")}
                                className={cn(
                                    "flex w-auto items-center justify-start text-left gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                                    activeSection === "alerts"
                                        ? "bg-background border-border shadow-sm text-foreground"
                                        : "border-transparent text-muted-foreground hover:bg-background/50 hover:text-foreground"
                                )}
                            >
                                <Bell className="w-4 h-4" />
                                <span className="whitespace-nowrap">Alerts</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="p-6 max-w-7xl">
                    <div className={activeSection === "triggers" ? "block" : "hidden"}>
                        <InputLayout inputs={inputs} setInputs={setInputs} isIncomplete={triggersIncomplete} />
                    </div>

                    <div className={activeSection === "prompt" ? "block" : "hidden"}>
                        <div className="space-y-4">
                            <div>
                                <h2 className="text-lg font-medium mb-1">Instructions</h2>
                                <p className="text-sm text-muted-foreground">Tell the agent what to do and how to respond. Include goals, guardrails, and the style of the output.</p>
                            </div>
                            <div className="h-[calc(100vh-19rem)] min-h-[360px] md:h-[calc(100vh-16rem)] md:min-h-[420px]">
                                <InstructionsEditor prompt={prompt} setPrompt={setPrompt} />
                            </div>
                        </div>
                    </div>

                    <div className={activeSection === "skills" ? "block" : "hidden"}>
                        <OutputLayout outputs={outputs} setOutputs={setOutputs} isIncomplete={skillsIncomplete} />
                    </div>

                    <div className={cn(activeSection === "alerts" ? "block" : "hidden", "space-y-6")}>
                        <div>
                            <h2 className="text-lg font-medium mb-1">Alerts & Approval</h2>
                            <p className="text-sm text-muted-foreground mb-4">Configure when you want to be notified and whether actions need your approval.</p>
                        </div>
                        <AgentApprovalSettings outputs={outputs} toolApprovals={toolApprovals} onToolApprovalsChange={setToolApprovals} />
                        <AgentNotificationSettings settings={notificationSettings} onChange={setNotificationSettings} />
                    </div>
                </div>
            </div>
        </div>
    )
}

function InputLayout({ inputs, setInputs }: { inputs: TransientAgentTrigger[]; setInputs: (inputs: TransientAgentTrigger[]) => void; isIncomplete: boolean }) {
    const [showAddModal, setShowAddModal] = useState(false)

    const handleSelectPlatform = (config: ConfigType) => {
        const newInputId = uuidv4() // We need to mint a placeholder ID for the new input so that we can identify it later.
        const newInput: TransientAgentTrigger = { id: newInputId, config: undefined, configType: config }
        const newInputs: TransientAgentTrigger[] = [...inputs, newInput]
        setInputs(newInputs)
        setShowAddModal(false)
    }

    const handleRemove = (id: string) => {
        setInputs(inputs.filter(input => input.id !== id))
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-medium mb-1">Triggers</h2>
                <p className="text-sm text-muted-foreground">Choose what starts this agent. Connect tools like Slack, GitHub, or Gmail so it can respond to new activity.</p>
            </div>

            <div className="space-y-2">
                {inputs.map(input => (
                    <InputCard key={input.id} input={input} inputs={inputs} setInputs={setInputs} handleRemove={handleRemove} />
                ))}
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="w-full h-14 border-dashed hover:border-solid hover:bg-muted/50">
                    <PlusIcon className="size-4 mr-2" />
                    Add trigger
                </Button>
            </div>

            <AddTriggerModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSelectIntegration={handleSelectPlatform} />
        </div>
    )
}

function InputCard({
    input,
    inputs,
    setInputs,
    handleRemove
}: {
    input: TransientAgentTrigger
    inputs: TransientAgentTrigger[]
    setInputs: (inputs: TransientAgentTrigger[]) => void
    handleRemove: (id: string) => void
}) {
    const needsConfiguration = !input.config || !input.config.isComplete()
    const [showDetailsDialog, setShowDetailsDialog] = useState(false)
    const [draftConfig, setDraftConfig] = useState<ConfigInstance | undefined>(input.config)

    const draftInput = { ...input, config: draftConfig }
    const isDraftValid = draftConfig?.isComplete() ?? false

    const handleOpenDialog = () => {
        setDraftConfig(input.config)
        setShowDetailsDialog(true)
    }

    const handleCancel = () => {
        setDraftConfig(input.config)
        setShowDetailsDialog(false)
    }

    const handleDone = () => {
        if (draftConfig) {
            setInputs(inputs.map(i => (i.id === input.id ? { ...i, config: draftConfig, configType: draftConfig.configType } : i)))
        }
        setShowDetailsDialog(false)
    }

    const selectorProps: InputConfigSelectorProps = {
        input: draftInput,
        setConfig: setDraftConfig,
        variant: "card"
    }

    return (
        <>
            <div
                className={cn("flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50", needsConfiguration && "border-yellow-500/50")}
                onClick={handleOpenDialog}
            >
                <div className="w-10 h-10 shrink-0">
                    <IconForConfigType type={input.configType} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{CONFIG_DETAILS[input.configType].name}</div>
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
                    onClick={e => {
                        e.stopPropagation()
                        handleRemove(input.id)
                    }}
                    className="shrink-0 hover:text-destructive"
                >
                    <XIcon className="w-4 h-4" />
                </Button>
            </div>

            <Dialog
                open={showDetailsDialog}
                onOpenChange={open => {
                    if (!open) handleCancel()
                }}
            >
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{needsConfiguration ? "Configure Trigger" : "Trigger Details"}</DialogTitle>
                    </DialogHeader>
                    <IntegrationSelector {...selectorProps} variant="dialog" />
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button onClick={handleDone} disabled={!isDraftValid}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function OutputLayout({ outputs, setOutputs }: { outputs: TransientAgentOutput[]; setOutputs: (outputs: TransientAgentOutput[]) => void; isIncomplete: boolean }) {
    const [showAddModal, setShowAddModal] = useState(false)

    const handleSelectOutput = (configType: ConfigType) => {
        const newOutputId = uuidv4()
        const newOutput: TransientAgentOutput = {
            id: newOutputId,
            config: undefined,
            configType: configType
        }
        const newOutputs = [...outputs, newOutput]
        setOutputs(newOutputs)
        setShowAddModal(false)
    }

    const handleRemove = (id: string) => {
        setOutputs(outputs.filter(output => output.id !== id))
    }

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-medium mb-1">Skills</h2>
                <p className="text-sm text-muted-foreground">Tools and integrations the agent can use to take action. Add skills like GitHub, Linear, or Slack.</p>
            </div>

            <div className="space-y-2">
                {outputs.map(output => (
                    <SkillCard key={output.id} output={output} outputs={outputs} setOutputs={setOutputs} handleRemove={handleRemove} />
                ))}
                <Button variant="outline" onClick={() => setShowAddModal(true)} className="w-full h-14 border-dashed hover:border-solid hover:bg-muted/50">
                    <PlusIcon className="size-4 mr-2" />
                    Add skill
                </Button>
            </div>

            <AddOutputModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSelectOutput={handleSelectOutput} />
        </div>
    )
}

function SkillCard({
    output,
    outputs,
    setOutputs,
    handleRemove
}: {
    output: TransientAgentOutput
    outputs: TransientAgentOutput[]
    setOutputs: (outputs: TransientAgentOutput[]) => void
    handleRemove: (id: string) => void
}) {
    const [showDetailsDialog, setShowDetailsDialog] = useState(false)
    const needsConfiguration = !output.config || !output.config.isComplete()
    const [draftConfig, setDraftConfig] = useState<ConfigInstance | undefined>(output.config)

    const draftOutput = { ...output, config: draftConfig }
    const isDraftValid = draftConfig?.isComplete() ?? false

    const handleOpenDialog = () => {
        setDraftConfig(output.config)
        setShowDetailsDialog(true)
    }

    const handleCancel = () => {
        setDraftConfig(output.config)
        setShowDetailsDialog(false)
    }

    const handleDone = () => {
        if (draftConfig) {
            setOutputs(outputs.map(o => (o.id === output.id ? { ...o, config: draftConfig, configType: draftConfig.configType } : o)))
        }
        setShowDetailsDialog(false)
    }

    const selectorProps: InputConfigSelectorProps = {
        input: draftOutput,
        setConfig: setDraftConfig,
        variant: "card"
    }

    return (
        <>
            <div
                className={cn("flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50", needsConfiguration && "border-yellow-500/50")}
                onClick={handleOpenDialog}
            >
                <div className="w-10 h-10 shrink-0">
                    <IconForConfigType type={output.configType} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{CONFIG_DETAILS[output.configType].name}</div>
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
                    onClick={e => {
                        e.stopPropagation()
                        handleRemove(output.id)
                    }}
                    className="shrink-0 hover:text-destructive"
                >
                    <XIcon className="w-4 h-4" />
                </Button>
            </div>

            <Dialog
                open={showDetailsDialog}
                onOpenChange={open => {
                    if (!open) handleCancel()
                }}
            >
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{needsConfiguration ? "Configure Skill" : "Skill Details"}</DialogTitle>
                    </DialogHeader>
                    <IntegrationSelector {...selectorProps} variant="dialog" />
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button onClick={handleDone} disabled={!isDraftValid}>
                            Done
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
