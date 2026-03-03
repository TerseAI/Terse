import { useState } from "react"
import { useNavigate } from "react-router-dom"

import { Tab, TabGroup, TabList } from "@headlessui/react"
import { Clock, Info, MoreVertical, Pause, Play, Trash2 } from "lucide-react"
import { toast } from "sonner"

import BreadCrumb from "../../components/BreadCrumb"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../components/ui/dropdown-menu"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { useAgent, useAgentMutations } from "../../hooks/api/useAgents"
import { FrontendRoutes } from "../../shared/FrontendRoutes"
import { CONFIG_DETAILS } from "../../shared/Configs"

import AgentRunHistoryTab from "./tabs/AgentRunHistoryTab"
import { IconForConfigType } from "./components/Integration"

const SDK_DETAIL_TABS = ["overview", "activity"] as const

export default function SdkJobDetail({ agentId }: { agentId: string }) {
    const navigate = useNavigate()
    const { agent, isLoading, mutate } = useAgent(agentId)
    const { deleteAgent, updateAgent } = useAgentMutations()

    const [selectedTab, setSelectedTab] = useState(0)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleToggleActive = async () => {
        if (!agent) return
        try {
            await updateAgent({
                id: agentId,
                data: { isActive: !agent.isActive },
                mutateAgent: mutate
            })
            toast.success(agent.isActive ? "Job paused" : "Job resumed")
        } catch (error) {
            console.error("Failed to toggle job status:", error)
            toast.error("Failed to update job status")
        }
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteAgent(agentId)
            toast.success("Job deleted")
            navigate(FrontendRoutes.AGENTS.SETUP)
        } catch (error) {
            console.error("Failed to delete job:", error)
            toast.error("Failed to delete job")
        } finally {
            setIsDeleting(false)
            setShowDeleteDialog(false)
        }
    }

    if (isLoading || !agent) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground text-sm">Loading...</div>
            </div>
        )
    }

    const triggers = agent.triggers ?? []

    return (
        <div className="flex h-full min-w-0 flex-col">
            {/* Header */}
            <div className="flex items-center gap-4 px-2 py-2.5">
                <SidebarTrigger />
                <div className="hidden sm:block">
                    <BreadCrumb inline />
                </div>
            </div>

            <div className="flex items-center gap-3 px-4 pb-2">
                <h1 className="text-lg font-semibold truncate">{agent.name}</h1>
                <Badge variant="outline" className={agent.isActive ? "text-green-600 border-green-500" : "text-muted-foreground"}>
                    {agent.isActive ? "Active" : "Paused"}
                </Badge>
                <div className="ml-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleToggleActive}>
                                {agent.isActive ? (
                                    <>
                                        <Pause className="h-4 w-4" />
                                        Pause Job
                                    </>
                                ) : (
                                    <>
                                        <Play className="h-4 w-4" />
                                        Resume Job
                                    </>
                                )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                                <Trash2 className="h-4 w-4" />
                                Delete Job
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Tabs */}
            <TabGroup selectedIndex={selectedTab} onChange={setSelectedTab} className="flex flex-1 flex-col min-h-0 pl-2">
                <TabList className="flex gap-2 border-b border-input items-center pt-2">
                    <Tab
                        className={({ selected }) =>
                            `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                        }
                    >
                        <Info className="h-4 w-4" />
                        <span>Overview</span>
                    </Tab>
                    <Tab
                        className={({ selected }) =>
                            `px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px inline-flex items-center gap-2 ${selected ? "text-foreground border-primary" : "text-muted-foreground border-transparent hover:text-foreground"}`
                        }
                    >
                        <Clock className="h-4 w-4" />
                        <span>Activity</span>
                    </Tab>
                </TabList>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {selectedTab === 0 ? (
                        <OverviewTab triggers={triggers} updatedAt={agent.updatedAt} isActive={agent.isActive} />
                    ) : (
                        <AgentRunHistoryTab agentId={agentId} />
                    )}
                </div>
            </TabGroup>

            {/* Delete dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={open => !open && setShowDeleteDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Job</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <span className="font-semibold">{agent.name}</span>? This action cannot be undone and will remove all associated run history.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? "Deleting..." : "Delete Job"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function OverviewTab({
    triggers,
    updatedAt,
    isActive
}: {
    triggers: { id: string; config: { configType: string } }[]
    updatedAt?: string
    isActive: boolean
}) {
    return (
        <div className="p-4 space-y-6 max-w-2xl">
            {/* Status */}
            <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                <p className="text-sm">{isActive ? "Active — this job is listening for events and running automatically." : "Paused — this job will not process any events until resumed."}</p>
            </div>

            {/* Triggers */}
            <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-muted-foreground">Triggers</h3>
                {triggers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No triggers configured.</p>
                ) : (
                    <div className="space-y-2">
                        {triggers.map(trigger => {
                            const configType = trigger.config.configType
                            const details = CONFIG_DETAILS[configType as keyof typeof CONFIG_DETAILS]
                            return (
                                <div key={trigger.id} className="flex items-center gap-2 rounded-md border border-input p-2.5">
                                    <div className="w-6 h-6 shrink-0">
                                        <IconForConfigType type={configType as any} />
                                    </div>
                                    <span className="text-sm">{details?.name ?? configType}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Source */}
            <div className="space-y-1.5">
                <h3 className="text-sm font-medium text-muted-foreground">Source</h3>
                <p className="text-sm">Deployed via SDK. Configuration is managed in code.</p>
            </div>

            {/* Last deployed */}
            {updatedAt && (
                <div className="space-y-1.5">
                    <h3 className="text-sm font-medium text-muted-foreground">Last Deployed</h3>
                    <p className="text-sm">{new Date(updatedAt).toLocaleString()}</p>
                </div>
            )}
        </div>
    )
}
