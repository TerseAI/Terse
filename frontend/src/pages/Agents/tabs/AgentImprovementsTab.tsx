import { RefObject, useMemo, useState } from "react"

import { ChevronRight } from "lucide-react"
import { toast } from "sonner"

import { BuilderChatHandle } from "@/components/chat/BuilderChat"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useAgentImprovements } from "@/hooks/api/useAgentImprovements"
import { cn } from "@/lib/utils"
import { BackendProvider } from "@/services/backend"
import { AgentImprovement } from "@/shared/types"
import { formatRelativeTime } from "@/utility/timeUtils"

const CHAT_OPEN_DELAY_MS = 300

type AgentImprovementsTabProps = {
    agentId: string | null
    builderChatRef: RefObject<BuilderChatHandle | null>
    setBuilderChatOpen: (open: boolean) => void
    builderChatOpen: boolean
}

type StatusFilter = "PENDING" | "ALL"

function getScoreColor(score: number): string {
    if (score >= 80) return "text-emerald-500 dark:text-emerald-400"
    if (score >= 60) return "text-yellow-500 dark:text-yellow-400"
    return "text-red-500 dark:text-red-400"
}

function getScoreBg(score: number): string {
    if (score >= 80) return "border-emerald-500/20"
    if (score >= 60) return "border-yellow-500/20"
    return "border-red-500/20"
}

function getStatusBadge(status: AgentImprovement["status"]) {
    if (status === "APPLIED") {
        return (
            <Badge variant="outline" className="border-green-500 text-green-600">
                Applied
            </Badge>
        )
    }
    if (status === "DISMISSED") {
        return (
            <Badge variant="outline" className="border-muted-foreground/50 text-muted-foreground">
                Dismissed
            </Badge>
        )
    }
    return (
        <Badge variant="outline" className="border-primary/40 text-primary">
            Pending
        </Badge>
    )
}

function formatTargetArea(area: AgentImprovement["targetArea"]): string {
    switch (area) {
        case "prompt":
            return "Prompt"
        case "trigger_config":
            return "Trigger Config"
        case "output_config":
            return "Output Config"
        default:
            return "General"
    }
}

export default function AgentImprovementsTab({ agentId, builderChatRef, setBuilderChatOpen, builderChatOpen }: AgentImprovementsTabProps) {
    const { review, improvements, improvementsEnabled, isLoading, mutate } = useAgentImprovements(agentId)
    const [isToggling, setIsToggling] = useState(false)
    const [isApplyingId, setIsApplyingId] = useState<string | null>(null)
    const [isDismissingId, setIsDismissingId] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING")

    const filteredImprovements = useMemo(() => {
        if (statusFilter === "ALL") return improvements
        return improvements.filter(i => i.status === "PENDING")
    }, [improvements, statusFilter])

    if (!agentId) {
        return <div className="p-4 text-sm text-muted-foreground">Save this agent first to receive weekly improvements.</div>
    }

    const handleToggleEnabled = async (enabled: boolean) => {
        setIsToggling(true)
        try {
            await BackendProvider.toggleImprovementsEnabled(agentId, enabled)
            await mutate()
        } catch (error) {
            console.error("Failed to toggle improvements setting", error)
            toast.error("Failed to update improvements setting")
        } finally {
            setIsToggling(false)
        }
    }

    const handleApply = async (improvement: AgentImprovement) => {
        setIsApplyingId(improvement.id)
        try {
            const response = await BackendProvider.applyImprovement(agentId, improvement.id)
            await mutate()
            setBuilderChatOpen(true)
            setTimeout(
                () => {
                    builderChatRef.current?.setInput(response.appliedPrompt)
                    builderChatRef.current?.focus()
                },
                builderChatOpen ? 0 : CHAT_OPEN_DELAY_MS
            )
            toast.success("Improvement applied. Review the prompt in builder chat.")
        } catch (error) {
            console.error("Failed to apply improvement", error)
            toast.error("Failed to apply improvement")
        } finally {
            setIsApplyingId(null)
        }
    }

    const handleDismiss = async (improvementId: string) => {
        setIsDismissingId(improvementId)
        try {
            await BackendProvider.dismissImprovement(agentId, improvementId)
            await mutate()
            toast.success("Improvement dismissed")
        } catch (error) {
            console.error("Failed to dismiss improvement", error)
            toast.error("Failed to dismiss improvement")
        } finally {
            setIsDismissingId(null)
        }
    }

    if (isLoading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading improvements...</div>
    }

    return (
        <div className="flex flex-col h-full p-4 space-y-4">
            {!review ? (
                <p className="text-sm text-muted-foreground">No review available yet. Reviews are generated weekly.</p>
            ) : (
                <div className="flex flex-col lg:flex-row lg:gap-0 flex-1 min-h-0">
                    {/* Left column: high-level review */}
                    <div className="flex-shrink-0 lg:w-[320px] space-y-4 lg:pr-6">
                        {/* Overall score */}
                        <div className="flex items-baseline gap-0.5">
                            <span className={cn("text-4xl font-semibold tabular-nums", getScoreColor(review.overallScore))}>{review.overallScore}</span>
                            <span className={cn("text-xl font-semibold", getScoreColor(review.overallScore))}>%</span>
                        </div>

                        {/* Dimension stat pills — matching home page StatPill style */}
                        <div className="grid grid-cols-3 gap-2">
                            <ScorePill label="Execution" value={review.scoreTaskQuality} />
                            <ScorePill label="Consistency" value={review.scoreConsistency} />
                            <ScorePill label="Efficiency" value={review.scoreEfficiency} />
                        </div>

                        <p className="text-sm text-muted-foreground">{review.summary}</p>
                        <p className="text-xs text-muted-foreground/60">Reviewed {formatRelativeTime(review.createdAt)}</p>
                    </div>

                    {/* Divider */}
                    <div className="hidden lg:block w-px bg-border/60 self-stretch mx-0" />
                    <div className="lg:hidden h-px bg-border/60 my-4" />

                    {/* Right column: recommendations */}
                    <div className="flex-1 lg:pl-6 space-y-3 min-w-0">
                        <div className="flex items-center justify-start">
                            <Select value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
                                <SelectTrigger className="h-8 w-[150px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="PENDING">Pending only</SelectItem>
                                    <SelectItem value="ALL">All</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {filteredImprovements.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {statusFilter === "PENDING" && improvements.length > 0 ? "No pending recommendations. Switch to \"All\" to see past ones." : "No recommendations for this review."}
                            </p>
                        ) : (
                            filteredImprovements.map(improvement => (
                                <ImprovementRow
                                    key={improvement.id}
                                    improvement={improvement}
                                    isApplying={isApplyingId === improvement.id}
                                    isDismissing={isDismissingId === improvement.id}
                                    disabled={isApplyingId !== null || isDismissingId !== null}
                                    onApply={() => handleApply(improvement)}
                                    onDismiss={() => handleDismiss(improvement.id)}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Toggle — bottom left */}
            <div className="flex items-center gap-2 pt-2 mt-auto">
                <Switch checked={improvementsEnabled} onCheckedChange={handleToggleEnabled} disabled={isToggling} />
                <span className="text-sm text-muted-foreground">{improvementsEnabled ? "Reviews enabled" : "Reviews disabled"}</span>
            </div>
        </div>
    )
}

function ImprovementRow({
    improvement,
    isApplying,
    isDismissing,
    disabled,
    onApply,
    onDismiss
}: {
    improvement: AgentImprovement
    isApplying: boolean
    isDismissing: boolean
    disabled: boolean
    onApply: () => void
    onDismiss: () => void
}) {
    const [expanded, setExpanded] = useState(false)
    const isPending = improvement.status === "PENDING"

    return (
        <div className="rounded-lg border border-border bg-card/50 px-4 py-3 space-y-0">
            <button type="button" onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 w-full text-left">
                <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", expanded && "rotate-90")} />
                <span className="font-medium text-sm flex-1">{improvement.title}</span>
                {!isPending && getStatusBadge(improvement.status)}
            </button>
            {expanded && (
                <div className="pl-[22px] pt-2 space-y-2">
                    <p className="text-sm text-muted-foreground">{improvement.description}</p>
                    {isPending && (
                        <div className="flex items-center gap-2 pt-1">
                            <Button size="sm" onClick={onApply} disabled={disabled}>
                                {isApplying ? "Applying..." : "Apply"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={onDismiss} disabled={disabled}>
                                {isDismissing ? "Dismissing..." : "Dismiss"}
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function ScorePill({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex flex-col gap-1 rounded-2xl bg-card/50 backdrop-blur-sm px-3 py-2.5 transition-all duration-300 hover:bg-card hover:shadow-sm">
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase leading-tight">{label}</span>
            <span className={cn("text-lg font-semibold tabular-nums tracking-tight", getScoreColor(value))}>{value}</span>
        </div>
    )
}
