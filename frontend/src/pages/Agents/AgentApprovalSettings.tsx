import { Loader2 } from "lucide-react"

import { TerseTool } from "@/shared/ToolsTypes"
import { TransientAgentOutput } from "@/shared/types"

import { MultiSelect, type MultiSelectOption } from "../../components/MultiSelect"
import { Badge } from "../../components/ui/badge"
import { Label } from "../../components/ui/label"
import { useToolsThatRequireApprovals } from "../../hooks/api/useToolsThatRequireApprovals"

import { IconForConfigType } from "./components/Integration"

export type AgentApprovalSettingsProps = {
    outputs: TransientAgentOutput[]
    toolApprovals: string[]
    onToolApprovalsChange: (toolApprovals: string[]) => void
}

function ApprovalSettingsCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3 p-4 border rounded-lg">
            <div className="flex flex-col gap-1">
                <Label className="text-base font-medium">Approval Settings</Label>
                {children}
            </div>
        </div>
    )
}

function toolToOption(tool: TerseTool): MultiSelectOption {
    return { id: tool.name, label: tool.displayName }
}

function AgentApprovalSettings({ outputs, toolApprovals, onToolApprovalsChange }: AgentApprovalSettingsProps) {
    const outputConfigTypes = outputs.filter(output => output.config && output.config.isComplete()).map(output => output.configType)

    const request = outputConfigTypes.length > 0 ? { skills: outputConfigTypes } : null

    const { tools: toolsThatRequireApprovals, isLoading, isError } = useToolsThatRequireApprovals(request)

    const options = toolsThatRequireApprovals.map(toolToOption)
    const selectedCount = toolApprovals.length

    const renderBody = () => {
        if (outputConfigTypes.length === 0) {
            return <p className="text-sm text-muted-foreground">Add at least one skill to choose approval tools.</p>
        }

        if (isLoading) {
            return (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading tools that require approvals...</span>
                </div>
            )
        }

        if (isError) {
            return <p className="text-sm text-destructive">Failed to load tools that require approvals</p>
        }

        if (toolsThatRequireApprovals.length === 0) {
            return <p className="text-sm text-muted-foreground">No tools available for approval in the current skills.</p>
        }

        const toolMap = new Map(toolsThatRequireApprovals.map(t => [t.name, t]))

        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-medium">Require approval for these tools</Label>
                    <Badge variant="outline">{selectedCount} selected</Badge>
                </div>
                <MultiSelect
                    options={options}
                    selectedIds={toolApprovals}
                    onSelect={ids => onToolApprovalsChange(ids as string[])}
                    placeholder="Select tools..."
                    searchPlaceholder="Search tools..."
                    emptyMessage="No tools found."
                    displayText={count => (count > 0 ? `${count} tool${count !== 1 ? "s" : ""} selected` : "Select tools...")}
                    renderItem={option => {
                        const tool = toolMap.get(option.id as string)
                        return (
                            <span className="flex flex-row gap-2">
                                {tool && (
                                    <span className="flex size-[20px] shrink-0">
                                        <IconForConfigType type={tool.configType} />
                                    </span>
                                )}
                                {option.label}
                            </span>
                        )
                    }}
                    renderBadge={option => {
                        const tool = toolMap.get(option.id as string)
                        return (
                            <span className="flex flex-row gap-2 items-center justify-center">
                                {tool && (
                                    <span className="flex size-[20px] shrink-0">
                                        <IconForConfigType type={tool.configType} />
                                    </span>
                                )}
                                {option.label}
                            </span>
                        )
                    }}
                />
            </div>
        )
    }

    return <ApprovalSettingsCard>{renderBody()}</ApprovalSettingsCard>
}

export default AgentApprovalSettings
