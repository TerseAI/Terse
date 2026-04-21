import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

import { AlertTriangle, CheckCircle2, Circle, Key, Server, Shield } from "lucide-react"
import { toast } from "sonner"
import { FrontendRoutes, buildRoute } from "terse-types"

import BreadCrumb from "../../components/BreadCrumb"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog"
import { SidebarTrigger } from "../../components/ui/sidebar"
import { useProject, useProjectMutations } from "../../hooks/api/useProject"

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { project, isLoading, isError } = useProject(id ?? null)
    const { deleteProject } = useProjectMutations()
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    if (isLoading) {
        return <CenteredMessage text="Loading..." aria="true" />
    }

    if (isError || !project) {
        return <CenteredMessage text="Project not found" />
    }

    const handleDelete = async () => {
        setIsDeleting(true)
        try {
            await deleteProject(project.id)
            toast.success(`Deleted project "${project.name}"`)
            navigate(FrontendRoutes.APP)
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status
            if (status === 409) {
                toast.error("Can't delete: project has in-flight runs. Wait for them to finish.")
            } else {
                toast.error("Failed to delete project")
            }
        } finally {
            setIsDeleting(false)
            setShowDeleteDialog(false)
        }
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
                <DangerZoneSection jobCount={project.jobs.length} onDelete={() => setShowDeleteDialog(true)} />
            </div>

            <Dialog open={showDeleteDialog} onOpenChange={open => !open && setShowDeleteDialog(false)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete project</DialogTitle>
                        <DialogDescription>
                            This will permanently delete <span className="font-semibold">{project.name}</span>
                            {project.jobs.length > 0 ? ` and all ${project.jobs.length} job${project.jobs.length === 1 ? "" : "s"} inside it` : ""}, along with run history and credentials. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? "Deleting..." : "Delete project"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
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

function DangerZoneSection({ jobCount, onDelete }: { jobCount: number; onDelete: () => void }) {
    return (
        <section>
            <SectionHeader icon={<AlertTriangle className="h-4 w-4 text-destructive" />} title="Danger zone" />
            <div className="rounded-md border border-destructive/40 p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">Delete project</div>
                    <div className="text-xs text-muted-foreground">Removes the project{jobCount > 0 ? `, its ${jobCount} job${jobCount === 1 ? "" : "s"},` : ""} and all associated run history.</div>
                </div>
                <Button variant="destructive" size="sm" onClick={onDelete}>
                    Delete
                </Button>
            </div>
        </section>
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
                        <Link key={job.id} to={buildRoute(FrontendRoutes.AGENTS.BY_ID, { id: job.id })} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
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
