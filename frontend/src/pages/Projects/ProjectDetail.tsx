import { Link, useParams } from "react-router-dom"

import { CheckCircle2, Circle, Key, Server, Shield } from "lucide-react"
import { FrontendRoutes, buildRoute } from "terse-types"

import BreadCrumb from "../../components/BreadCrumb"
import { Badge } from "../../components/ui/badge"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { useProject } from "../../hooks/api/useProject"

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>()
    const { project, isLoading, isError } = useProject(id ?? null)

    if (isLoading) {
        return <CenteredMessage text="Loading..." aria="true" />
    }

    if (isError || !project) {
        return <CenteredMessage text="Project not found" />
    }

    return (
        <div className="flex h-full min-w-0 flex-col">
            <div className="flex items-center gap-4 px-2 py-2.5">
                <SidebarTrigger />
                <div className="hidden sm:block">
                    <BreadCrumb inline />
                </div>
            </div>

            <div className="flex items-center gap-3 px-4 pb-2">
                <h1 className="text-lg font-semibold truncate">{project.name}</h1>
                <Badge variant="outline" className={project.isSelfHosted ? "text-foreground" : "text-muted-foreground"}>
                    {project.isSelfHosted ? "Self-hosted" : "Managed"}
                </Badge>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 space-y-6">
                {project.isSelfHosted && <SelfHostedSection remoteServerUrl={project.remoteServerUrl} />}
                {project.isSelfHosted && <CredentialsSection hasSigningSecret={project.hasSigningSecret} hasProjectApiKey={project.hasProjectApiKey} />}
                <JobsSection jobs={project.jobs} />
            </div>
        </div>
    )
}

function SelfHostedSection({ remoteServerUrl }: { remoteServerUrl: string | null }) {
    return (
        <section>
            <SectionHeader icon={<Server className="h-4 w-4" />} title="Server" />
            <div className="rounded-md border border-input p-3 text-sm">
                <div className="text-muted-foreground text-xs mb-1">Remote server URL</div>
                <code className="text-foreground break-all">{remoteServerUrl ?? "—"}</code>
            </div>
        </section>
    )
}

function CredentialsSection({ hasSigningSecret, hasProjectApiKey }: { hasSigningSecret: boolean; hasProjectApiKey: boolean }) {
    return (
        <section>
            <SectionHeader icon={<Shield className="h-4 w-4" />} title="Credentials" />
            <div className="rounded-md border border-input divide-y divide-input">
                <CredentialRow icon={<Key className="h-4 w-4" />} label="Project API key" configured={hasProjectApiKey} />
                <CredentialRow icon={<Shield className="h-4 w-4" />} label="Signing secret" configured={hasSigningSecret} />
            </div>
            <p className="text-muted-foreground text-xs mt-2">Credentials are shown once at deploy. Rotate from here to issue a new value (coming soon).</p>
        </section>
    )
}

function CredentialRow({ icon, label, configured }: { icon: React.ReactNode; label: string; configured: boolean }) {
    return (
        <div className="flex items-center gap-3 p-3">
            <span className="text-muted-foreground">{icon}</span>
            <span className="text-sm">{label}</span>
            <span className="ml-auto flex items-center gap-1.5 text-xs">
                {configured ? (
                    <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        <span className="text-success">Configured</span>
                    </>
                ) : (
                    <>
                        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Not set</span>
                    </>
                )}
            </span>
        </div>
    )
}

function JobsSection({ jobs }: { jobs: { id: string; name: string; isActive: boolean }[] }) {
    return (
        <section>
            <SectionHeader title={`Jobs (${jobs.length})`} />
            {jobs.length === 0 ? (
                <div className="rounded-md border border-input p-3 text-sm text-muted-foreground">No jobs deployed to this project yet.</div>
            ) : (
                <div className="rounded-md border border-input divide-y divide-input">
                    {jobs.map(job => (
                        <Link
                            key={job.id}
                            to={buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: job.id })}
                            className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
                        >
                            <span className="text-sm truncate">{job.name}</span>
                            <Badge variant="outline" className={`ml-auto ${job.isActive ? "text-success border-success" : "text-muted-foreground"}`}>
                                {job.isActive ? "Active" : "Paused"}
                            </Badge>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    )
}

function SectionHeader({ icon, title }: { icon?: React.ReactNode; title: string }) {
    return (
        <h2 className="flex items-center gap-2 text-sm font-medium mb-2">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            <span>{title}</span>
        </h2>
    )
}

function CenteredMessage({ text, aria }: { text: string; aria?: string }) {
    return (
        <div className="flex h-full items-center justify-center" aria-busy={aria}>
            <div className="text-muted-foreground text-sm" role="status">
                {text}
            </div>
        </div>
    )
}
