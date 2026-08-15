import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"

import { AlertTriangle, ArrowRight, Check, Copy, Terminal } from "lucide-react"
import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"
import type { Agent } from "terse-types/types"

import { PageFrame } from "@/components/PageFrame"
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
            <PageFrame>
                <EmptyState />
            </PageFrame>
        )
    }

    const isLoading = agentsLoading || runsLoading

    return (
        <PageFrame>
            <div className="space-y-8">
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
        </PageFrame>
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
                <h2 className="text-sm font-medium text-foreground">{group.projectName}</h2>
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

const INSTALL_LINES = ["npx terse-cli install"]
const CREATE_PROMPT = "/terse-create Summarize related PRs and DM the assignee in Slack when a Linear issue lands in Triage."

type CopyTarget = "install" | "create"

function EmptyState() {
    const [copied, setCopied] = useState<CopyTarget | null>(null)
    const copyResetRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const { setOpen } = useSidebar()

    useEffect(() => {
        setOpen(false)
        return () => setOpen(true)
    }, [])

    useEffect(() => {
        return () => {
            if (copyResetRef.current) clearTimeout(copyResetRef.current)
        }
    }, [])

    const handleCopy = (which: CopyTarget, text: string) => {
        void navigator.clipboard.writeText(text)
        setCopied(which)
        if (copyResetRef.current) clearTimeout(copyResetRef.current)
        copyResetRef.current = setTimeout(() => setCopied(null), 2000)
    }

    return (
        <div className="min-h-full flex items-center justify-center px-6 py-16">
            <div className="w-full max-w-md">
                <div className="flex items-center gap-2 mb-8">
                    <span className="block h-2 w-2 rounded-full bg-success" aria-hidden />
                    <span className="font-mono text-sm tracking-tight text-foreground">terse</span>
                </div>

                <h1 className="text-xl font-semibold tracking-tight text-foreground">Build your first job with Claude Code.</h1>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Install Terse and add the skill, then describe what you want in plain language.</p>

                <div className="mt-6 group relative">
                    <pre className="rounded-md bg-muted/60 border border-border/60 px-4 py-3 font-mono text-sm text-foreground">
                        {INSTALL_LINES.map(line => (
                            <div key={line} className="flex">
                                <span className="select-none text-muted-foreground pr-3">$</span>
                                <span>{line}</span>
                            </div>
                        ))}
                    </pre>
                    <button
                        type="button"
                        onClick={() => handleCopy("install", INSTALL_LINES.join("\n"))}
                        aria-label="Copy commands"
                        className="absolute right-1.5 top-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors before:absolute before:-inset-1.5 hover:bg-background hover:text-foreground"
                    >
                        {copied === "install" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === "install" ? "Copied" : "Copy"}
                    </button>
                </div>

                <p className="mt-6 text-xs font-medium text-muted-foreground">Then, in Claude Code</p>
                <div className="mt-2 group relative">
                    <div className="rounded-md bg-muted/60 border border-border/60 px-4 py-3 pr-20 font-mono text-sm leading-relaxed text-foreground">
                        <div className="flex">
                            <span className="select-none text-success pr-3">&gt;</span>
                            <span className="min-w-0 flex-1 text-muted-foreground break-words">
                                <span className="text-foreground">/terse-create</span> {CREATE_PROMPT.slice("/terse-create ".length)}
                            </span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleCopy("create", CREATE_PROMPT)}
                        aria-label="Copy create command"
                        className="absolute right-1.5 top-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground transition-colors before:absolute before:-inset-1.5 hover:bg-background hover:text-foreground"
                    >
                        {copied === "create" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === "create" ? "Copied" : "Copy"}
                    </button>
                </div>

                <div className="mt-8 flex flex-col gap-3 border-t border-border/60 pt-6 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <span>Prefer the CLI?</span>
                        <code className="font-mono text-foreground">terse init my-job</code>
                    </div>
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
