import { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { AlertTriangle, ArrowRight, Check, Copy, Terminal } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import type { Agent } from "terse-types/types"

import { useSidebar } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAgents } from "@/modules/agents/api/useAgents"
import { ALL_RUN_STATUSES, AgentHealth, AgentRow, AgentRowsSkeleton, HEALTH_RANK, computeHealth, groupRunsByAgent } from "@/modules/agents/components/AgentHealthRow"
import { usePendingApprovals } from "@/modules/notifications/api/usePendingApprovals"
import { useAllRunHistory } from "@/modules/runHistory/api/useAllRunHistory"

const RUN_FETCH_PAGE_SIZE = 200

export default function HomePage() {
    const { agents: allAgents, isLoading: agentsLoading } = useAgents({ limit: 100 })
    const { runs, isLoading: runsLoading } = useAllRunHistory({
        page: 1,
        pageSize: RUN_FETCH_PAGE_SIZE,
        selectedStatuses: ALL_RUN_STATUSES
    })
    const { approvals, isLoading: approvalsLoading } = usePendingApprovals({ status: "pending" })

    const agents = allAgents
    const runsByAgent = groupRunsByAgent(runs)
    const agentsWithHealth = agents
        .map(agent => ({ agent, health: computeHealth(agent, runsByAgent.get(agent.id) ?? []) }))
        .sort((a, b) => {
            const rank = HEALTH_RANK[a.health.status] - HEALTH_RANK[b.health.status]
            if (rank !== 0) return rank
            return a.agent.name.localeCompare(b.agent.name)
        })

    if (!agentsLoading && agents.length === 0) {
        return (
            <div className="h-full overflow-y-auto">
                <EmptyState />
            </div>
        )
    }

    const isLoading = agentsLoading || runsLoading

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-6 py-10 space-y-8">
                <header>
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">Home</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Job health across your org.</p>
                </header>

                {!approvalsLoading && approvals.length > 0 && <ApprovalsStrip count={approvals.length} />}

                {isLoading ? (
                    <section>
                        <AgentRowsSkeleton />
                    </section>
                ) : (
                    <TooltipProvider delayDuration={150}>
                        <div className="space-y-8">
                            {groupAgents(agentsWithHealth).map(group => (
                                <ProjectGroup key={group.key} group={group} />
                            ))}
                        </div>
                    </TooltipProvider>
                )}
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Approvals strip
// ---------------------------------------------------------------------------

function ApprovalsStrip({ count }: { count: number }) {
    return (
        <Link to={FrontendRoutes.NOTIFICATIONS} className="group flex items-center gap-3 rounded-md bg-warning/10 px-4 py-2.5 text-sm transition-colors hover:bg-warning/15">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="flex-1 text-foreground">
                <span className="font-medium tabular-nums">{count}</span> {count === 1 ? "approval waiting on you" : "approvals waiting on you"}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                Review
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
        </Link>
    )
}

// ---------------------------------------------------------------------------
// Project group
// ---------------------------------------------------------------------------

type AgentWithHealth = { agent: Agent; health: AgentHealth }
type AgentGroupData = {
    key: string
    projectId: string | null
    projectName: string
    agents: AgentWithHealth[]
}

function ProjectGroup({ group }: { group: AgentGroupData }) {
    return (
        <section>
            <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{group.projectName}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {group.agents.length} {group.agents.length === 1 ? "job" : "jobs"}
                </span>
            </div>
            <ul className="divide-y divide-border/60 border-y border-border/60">
                {group.agents.map(({ agent, health }) => (
                    <AgentRow key={agent.id} agent={agent} health={health} />
                ))}
            </ul>
        </section>
    )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const CLI_LINES = ["npm i -g terse-cli", "terse init my-job"]

function EmptyState() {
    const [copied, setCopied] = useState(false)
    const { setOpen } = useSidebar()

    useEffect(() => {
        setOpen(false)
        return () => setOpen(true)
    }, [])

    const handleCopy = () => {
        void navigator.clipboard.writeText(CLI_LINES.join("\n"))
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div className="min-h-full flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-md">
                <div className="flex items-center gap-2 mb-8">
                    <span className="block h-2 w-2 rounded-full bg-success" aria-hidden />
                    <span className="font-mono text-sm tracking-tight text-foreground">terse</span>
                </div>

                <h1 className="text-xl font-semibold tracking-tight text-foreground">Build your first job from your terminal.</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Terse jobs are built locally. Run the commands below to get started.</p>

                <div className="mt-6 group relative">
                    <pre className="rounded-md bg-muted/60 border border-border/60 px-4 py-3 font-mono text-sm text-foreground">
                        {CLI_LINES.map(line => (
                            <div key={line} className="flex">
                                <span className="select-none text-muted-foreground pr-3">$</span>
                                <span>{line}</span>
                            </div>
                        ))}
                    </pre>
                    <button
                        type="button"
                        onClick={handleCopy}
                        aria-label="Copy commands"
                        className="absolute top-2 right-2 inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                    >
                        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>

                <div className="mt-6 flex items-center gap-4 text-sm">
                    <a href="https://docs.useterse.ai" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                        <Terminal className="h-3.5 w-3.5" />
                        Read the docs
                        <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                </div>
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupAgents(items: AgentWithHealth[]): AgentGroupData[] {
    const buckets = new Map<string, AgentGroupData>()
    for (const item of items) {
        const projectId = item.agent.metadata?.projectId ?? null
        const projectName = item.agent.metadata?.projectName ?? "Unassigned"
        const key = projectId ?? "__unassigned__"
        const existing = buckets.get(key)
        if (existing) {
            existing.agents.push(item)
        } else {
            buckets.set(key, { key, projectId, projectName, agents: [item] })
        }
    }
    return Array.from(buckets.values()).sort((a, b) => {
        const aWorst = Math.min(...a.agents.map(x => HEALTH_RANK[x.health.status]))
        const bWorst = Math.min(...b.agents.map(x => HEALTH_RANK[x.health.status]))
        if (aWorst !== bWorst) return aWorst - bWorst
        if (a.projectId === null) return 1
        if (b.projectId === null) return -1
        return a.projectName.localeCompare(b.projectName)
    })
}
