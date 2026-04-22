import { useState } from "react"

import { Check, Copy, Loader2, Server } from "lucide-react"
import { toast } from "sonner"
import type { ProjectDetailResponse, SdkJobServerCheckResponse } from "terse-types/types"

import { Button } from "../../components/ui/button"
import { TooltipProvider } from "../../components/ui/tooltip"
import { useProjectDeploys } from "../../hooks/api/useProjectDeploys"
import { cn } from "../../lib/utils"
import { BackendProvider } from "../../services/backend"
import { SdkJobServerCheckDialog } from "../Agents/components/SdkJobServerCheckDialog"

import { DeleteProjectAction, DeploymentsSection, Heading, PageFrame, SectionLabel } from "./ProjectDetailShared"

export default function ProjectDetailSelfHosted({ project }: { project: ProjectDetailResponse }) {
    const { deploys, isLoading: isLoadingDeploys } = useProjectDeploys(project.id)
    const [isVerifying, setIsVerifying] = useState(false)
    const [result, setResult] = useState<SdkJobServerCheckResponse | null>(null)
    const [showDialog, setShowDialog] = useState(false)

    const activeDeploy = deploys?.find(d => d.isActive) ?? null
    const latestDeploy = deploys?.[0] ?? null
    const firstJobId = project.jobs[0]?.id ?? null

    const handleVerifyServer = async () => {
        if (!firstJobId) {
            toast.error("Deploy a job first, then verify the server.")
            return
        }
        setIsVerifying(true)
        try {
            setResult(await BackendProvider.verifySdkJobServer(firstJobId))
            setShowDialog(true)
        } catch {
            toast.error("Failed to verify server")
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <TooltipProvider delayDuration={200}>
            <PageFrame>
                <Heading project={project} activeDeploy={activeDeploy} latestDeploy={latestDeploy} />

                <EnvironmentSection
                    remoteServerUrl={project.remoteServerUrl}
                    hasSigningSecret={project.hasSigningSecret}
                    hasProjectApiKey={project.hasProjectApiKey}
                    onVerifyServer={handleVerifyServer}
                    isVerifyingServer={isVerifying}
                    canVerify={!!firstJobId}
                />

                <DeploymentsSection deploys={deploys} isLoading={isLoadingDeploys} />

                <DeleteProjectAction project={project} />
            </PageFrame>

            <SdkJobServerCheckDialog open={showDialog} result={result} onClose={() => setShowDialog(false)} />
        </TooltipProvider>
    )
}

function EnvironmentSection({
    remoteServerUrl,
    hasSigningSecret,
    hasProjectApiKey,
    onVerifyServer,
    isVerifyingServer,
    canVerify
}: {
    remoteServerUrl: string | null
    hasSigningSecret: boolean
    hasProjectApiKey: boolean
    onVerifyServer: () => void
    isVerifyingServer: boolean
    canVerify: boolean
}) {
    return (
        <section className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-4">
                <SectionLabel className="mb-0">Environment</SectionLabel>
                <Button variant="outline" size="sm" onClick={onVerifyServer} disabled={isVerifyingServer || !canVerify} title={canVerify ? undefined : "Deploy a job first to verify the server"}>
                    {isVerifyingServer ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
                    Verify server
                </Button>
            </div>
            <div className="border-border/60 bg-muted/10 flex flex-col divide-y overflow-hidden rounded-lg border md:flex-row md:divide-x md:divide-y-0">
                <EnvRow className="min-w-0 flex-[2]" label="Remote server">
                    <RemoteServerValue url={remoteServerUrl} />
                </EnvRow>
                <EnvRow className="flex-1" label="Project API key">
                    <ConfigStatus configured={hasProjectApiKey} />
                </EnvRow>
                <EnvRow className="flex-1" label="Signing secret">
                    <ConfigStatus configured={hasSigningSecret} />
                </EnvRow>
            </div>
        </section>
    )
}

function EnvRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
    return (
        <div className={cn("px-4 py-3", className)}>
            <div className="text-muted-foreground text-[10px] font-medium tracking-[0.14em] uppercase">{label}</div>
            <div className="mt-1.5 text-sm">{children}</div>
        </div>
    )
}

function RemoteServerValue({ url }: { url: string | null }) {
    const [copied, setCopied] = useState(false)
    if (!url) return <span className="text-muted-foreground">—</span>

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            toast.error("Could not copy")
        }
    }

    return (
        <div className="flex min-w-0 items-center gap-2">
            <code className="text-foreground min-w-0 flex-1 truncate font-mono text-[13px]">{url}</code>
            <button type="button" onClick={handleCopy} className="text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0 rounded-md p-1 transition-colors" aria-label="Copy server URL">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
        </div>
    )
}

function ConfigStatus({ configured }: { configured: boolean }) {
    return (
        <div className="flex items-center gap-2">
            <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", configured ? "bg-success" : "bg-muted-foreground/40")} />
            <span className={configured ? "text-foreground" : "text-muted-foreground"}>{configured ? "Configured" : "Not set"}</span>
        </div>
    )
}
