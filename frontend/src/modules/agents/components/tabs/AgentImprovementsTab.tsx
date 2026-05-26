import { useMemo, useState } from "react"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { AgentImprovement } from "terse-types/types"

import { Button } from "@/components/ui/button"
import { CopyCommandButton } from "@/components/ui/copy-command-button"
import { DiffViewer } from "@/components/ui/diff-viewer"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { BackendProvider } from "@/lib/http"
import { useAgentImprovements } from "@/modules/agents/api/useAgentImprovements"
import { formatRelativeTime } from "@/utils/time"

type AgentImprovementsTabProps = {
    agentId: string | null
}

/** Lightweight hook for the tab badge — reuses the same SWR cache as the full hook. */
export function useAgentPendingCount(agentId: string | null): number {
    const { improvements, improvementsEnabled } = useAgentImprovements(agentId)
    return useMemo(() => {
        if (!improvementsEnabled) return 0
        return improvements.filter(i => i.status === "PENDING").length
    }, [improvements, improvementsEnabled])
}

export default function AgentImprovementsTab({ agentId }: AgentImprovementsTabProps) {
    const { review, improvements, improvementsEnabled, isLoading, mutate } = useAgentImprovements(agentId)
    const [isToggling, setIsToggling] = useState(false)
    const [isDismissingId, setIsDismissingId] = useState<string | null>(null)
    const pendingImprovements = useMemo(() => improvements.filter(i => i.status === "PENDING"), [improvements])

    if (!agentId) {
        return <div className="p-4 text-sm text-muted-foreground">Save this job first to receive weekly improvements.</div>
    }

    const handleToggleEnabled = async (enabled: boolean) => {
        setIsToggling(true)
        try {
            await BackendProvider.toggleImprovementsEnabled(agentId, enabled)
            await mutate()
        } catch {
            toast.error("Failed to update improvements setting")
        } finally {
            setIsToggling(false)
        }
    }

    const handleDismiss = async (improvementId: string) => {
        setIsDismissingId(improvementId)
        try {
            await BackendProvider.dismissImprovement(agentId, improvementId)
            await mutate()
            toast("Improvement dismissed", {
                action: {
                    label: "Undo",
                    onClick: async () => {
                        try {
                            await BackendProvider.undoDismissImprovement(agentId, improvementId)
                            await mutate()
                            toast.success("Dismiss undone")
                        } catch {
                            toast.error("Failed to undo dismiss")
                        }
                    }
                }
            })
        } catch {
            toast.error("Failed to dismiss improvement")
        } finally {
            setIsDismissingId(null)
        }
    }

    if (isLoading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading improvements...</div>
    }

    const isBusy = isDismissingId !== null

    return (
        <div className="flex flex-col h-full p-4 space-y-4">
            {/* Title row + toggle */}
            <div className="flex items-center justify-between">
                {improvementsEnabled && review && pendingImprovements.length > 0 ? (
                    <h3 className="text-base font-semibold">{review.title || `Last review at ${new Date(review.createdAt).toLocaleDateString()}`}</h3>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {!improvementsEnabled
                            ? "Enable weekly reviews to get AI-generated improvement recommendations for this job."
                            : improvementsEnabled && review
                              ? "No pending recommendations. Check back next week for new reviews."
                              : "No review available yet. Reviews are generated weekly."}
                    </p>
                )}
                <div className="flex items-center gap-2 shrink-0">
                    {improvementsEnabled && <span className="text-sm text-muted-foreground">Enabled</span>}
                    <Switch checked={improvementsEnabled} onCheckedChange={handleToggleEnabled} disabled={isToggling} />
                </div>
            </div>

            {improvementsEnabled && review && pendingImprovements.length > 0 && (
                <>
                    <p className="text-sm text-muted-foreground">{review.summary}</p>
                    <p className="text-xs text-muted-foreground">Run these commands from your project directory using the Terse CLI.</p>

                    <Separator />

                    {/* Improvements */}
                    <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                        {pendingImprovements.length > 1 && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">{pendingImprovements.length} recommendations</span>
                            </div>
                        )}
                        {pendingImprovements.map(improvement => (
                            <ImprovementRow
                                key={improvement.id}
                                improvement={improvement}
                                isDismissing={isDismissingId === improvement.id}
                                disabled={isBusy}
                                onDismiss={() => handleDismiss(improvement.id)}
                                defaultExpanded={pendingImprovements.length === 1}
                            />
                        ))}
                    </div>
                    <span className="shrink-0 pt-2 text-xs text-muted-foreground">Reviewed {formatRelativeTime(review.createdAt)}</span>
                </>
            )}
        </div>
    )
}

function ImprovementRow({
    improvement,
    isDismissing,
    disabled,
    onDismiss,
    defaultExpanded = false
}: {
    improvement: AgentImprovement
    isDismissing: boolean
    disabled: boolean
    onDismiss: () => void
    defaultExpanded?: boolean
}) {
    const [expanded, setExpanded] = useState(defaultExpanded)

    return (
        <div className="rounded-lg border border-border bg-card/50 px-4 py-3">
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 flex-1 text-left min-w-0">
                    <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </motion.span>
                    <span className="font-medium text-sm truncate">{improvement.title}</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                    {improvement.suggestedPatch && <CopyCommandButton command={`terse apply ${improvement.id}`} title="Copy. Then run in your project's terminal" disabled={disabled} />}
                    <Button size="sm" variant="ghost" onClick={onDismiss} disabled={disabled}>
                        {isDismissing ? "Dismissing..." : "Dismiss"}
                    </Button>
                </div>
            </div>
            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="pl-[22px] pt-2 space-y-2">
                            <p className="text-sm text-muted-foreground">{improvement.description}</p>
                            {improvement.suggestedPatch && <DiffViewer patch={improvement.suggestedPatch} />}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
