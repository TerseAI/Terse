import { RefObject, useMemo, useState } from "react"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronRight, Download } from "lucide-react"
import { toast } from "sonner"

import { BuilderChatHandle } from "@/components/chat/BuilderChat"
import { Button } from "@/components/ui/button"
import { DiffViewer } from "@/components/ui/diff-viewer"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { useAgentImprovements } from "@/hooks/api/useAgentImprovements"
import { BackendProvider } from "@/services/backend"
import { Agent, AgentImprovement } from "@/shared/types"
import { formatRelativeTime } from "@/utility/timeUtils"

import { CopyPatchDialog } from "../components/CopyPatchDialog"

const CHAT_OPEN_DELAY_MS = 300

type AgentImprovementsTabProps = {
    agentId: string | null
    source?: Agent["source"]
    builderChatRef?: RefObject<BuilderChatHandle | null>
    setBuilderChatOpen?: (open: boolean) => void
    builderChatOpen?: boolean
}

/** Lightweight hook for the tab badge — reuses the same SWR cache as the full hook. */
export function useAgentPendingCount(agentId: string | null): number {
    const { improvements, improvementsEnabled } = useAgentImprovements(agentId)
    return useMemo(() => {
        if (!improvementsEnabled) return 0
        return improvements.filter(i => i.status === "PENDING").length
    }, [improvements, improvementsEnabled])
}

export default function AgentImprovementsTab({ agentId, source, builderChatRef, setBuilderChatOpen, builderChatOpen }: AgentImprovementsTabProps) {
    const isSdk = source === "SDK"
    const { review, improvements, improvementsEnabled, isLoading, mutate } = useAgentImprovements(agentId)
    const [isToggling, setIsToggling] = useState(false)
    const [isApplyingId, setIsApplyingId] = useState<string | null>(null)
    const [isDismissingId, setIsDismissingId] = useState<string | null>(null)
    const [isApplyingAll, setIsApplyingAll] = useState(false)
    const pendingImprovements = useMemo(() => improvements.filter(i => i.status === "PENDING"), [improvements])

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

            if (isSdk) {
                toast.success("Improvement acknowledged")
            } else {
                setBuilderChatOpen?.(true)
                setTimeout(
                    () => {
                        builderChatRef?.current?.sendMessage(response.appliedPrompt!)
                    },
                    builderChatOpen ? 0 : CHAT_OPEN_DELAY_MS
                )
                toast.success("Applying improvement via builder chat...")
            }
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
        } catch (error) {
            console.error("Failed to dismiss improvement", error)
            toast.error("Failed to dismiss improvement")
        } finally {
            setIsDismissingId(null)
        }
    }

    const handleApplyAll = async () => {
        setIsApplyingAll(true)
        try {
            const prompts: string[] = []
            for (const improvement of pendingImprovements) {
                const response = await BackendProvider.applyImprovement(agentId, improvement.id)
                if (response.appliedPrompt) {
                    prompts.push(response.appliedPrompt)
                }
            }
            await mutate()

            if (isSdk) {
                toast.success(`${pendingImprovements.length} improvements acknowledged`)
            } else if (prompts.length > 0) {
                const combined = prompts.join("\n\n---\n\n")
                setBuilderChatOpen?.(true)
                setTimeout(
                    () => {
                        builderChatRef?.current?.sendMessage(combined)
                    },
                    builderChatOpen ? 0 : CHAT_OPEN_DELAY_MS
                )
                toast.success(`Applying ${prompts.length} improvements via builder chat...`)
            }
        } catch (error) {
            console.error("Failed to apply all improvements", error)
            toast.error("Failed to apply all improvements")
            await mutate()
        } finally {
            setIsApplyingAll(false)
        }
    }

    if (isLoading) {
        return <div className="p-4 text-sm text-muted-foreground">Loading improvements...</div>
    }

    const isBusy = isApplyingId !== null || isDismissingId !== null || isApplyingAll

    return (
        <div className="flex flex-col h-full p-4 space-y-4">
            {/* Title row + toggle */}
            <div className="flex items-center justify-between">
                {improvementsEnabled && review && pendingImprovements.length > 0 ? (
                    <h3 className="text-base font-semibold">{review.title || `Last review at ${new Date(review.createdAt).toLocaleDateString()}`}</h3>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {!improvementsEnabled
                            ? "Enable weekly reviews to get AI-generated improvement recommendations for this agent."
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

                    <Separator />

                    {/* Improvements */}
                    <div className="space-y-3 flex-1 min-h-0">
                        {pendingImprovements.length > 1 && (
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">{pendingImprovements.length} recommendations</span>
                                <Button size="sm" variant="outline" onClick={handleApplyAll} disabled={isBusy}>
                                    {isApplyingAll ? "Applying all..." : "Apply all"}
                                </Button>
                            </div>
                        )}
                        <AnimatePresence initial={false}>
                            {pendingImprovements.map((improvement, index) => (
                                <motion.div
                                    key={improvement.id}
                                    layout
                                    initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                    exit={{ opacity: 0, x: -20, filter: "blur(4px)", transition: { duration: 0.15 } }}
                                    transition={{ duration: 0.25, delay: index * 0.05, ease: [0.25, 1, 0.5, 1] }}
                                >
                                    <ImprovementRow
                                        improvement={improvement}
                                        isSdk={isSdk}
                                        isApplying={isApplyingId === improvement.id}
                                        isDismissing={isDismissingId === improvement.id}
                                        disabled={isBusy}
                                        onApply={() => handleApply(improvement)}
                                        onDismiss={() => handleDismiss(improvement.id)}
                                        defaultExpanded={pendingImprovements.length === 1}
                                    />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                    <span className="text-xs text-muted-foreground mt-auto">Reviewed {formatRelativeTime(review.createdAt)}</span>
                </>
            )}
        </div>
    )
}

function ImprovementRow({
    improvement,
    isSdk = false,
    isApplying,
    isDismissing,
    disabled,
    onApply,
    onDismiss,
    defaultExpanded = false
}: {
    improvement: AgentImprovement
    isSdk?: boolean
    isApplying: boolean
    isDismissing: boolean
    disabled: boolean
    onApply: () => void
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
                    {isSdk && improvement.suggestedPatch && (
                        <CopyPatchDialog patch={improvement.suggestedPatch} title={improvement.title}>
                            {openDialog => (
                                <Button size="sm" variant="outline" onClick={openDialog}>
                                    <Download className="h-3.5 w-3.5 mr-1" />
                                    Download Patch
                                </Button>
                            )}
                        </CopyPatchDialog>
                    )}
                    <Button size="sm" onClick={onApply} disabled={disabled}>
                        {isApplying ? "Acknowledging..." : isSdk ? "Acknowledge" : "Apply"}
                    </Button>
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
                            {isSdk && improvement.suggestedPatch && <DiffViewer patch={improvement.suggestedPatch} />}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
