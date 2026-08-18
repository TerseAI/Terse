import { useState } from "react"

import { AlertTriangle, Check, CheckCircle2, Circle, Copy, KeyRound, Loader2, RotateCw, Server, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import type { ProjectDetailResponse, SdkJobServerCheckResponse } from "terse-types/types"

import { PageFrame } from "@/components/PageFrame"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { BackendProvider } from "@/lib/http"
import { cn } from "@/lib/utils"
import { SdkJobServerCheckDialog } from "@/modules/agents/components/SdkJobServerCheckDialog"
import { useProjectDeploys } from "@/modules/projects/api/useProjectDeploys"

import { Heading, ProjectSectionsTabs, SectionLabel } from "./ProjectDetailShared"

export default function ProjectDetailSelfHosted({ project }: { project: ProjectDetailResponse }) {
    const { deploys, isLoading: isLoadingDeploys } = useProjectDeploys(project.id)
    const [isVerifying, setIsVerifying] = useState(false)
    const [verifyResult, setVerifyResult] = useState<SdkJobServerCheckResponse | null>(null)
    const [pendingRotate, setPendingRotate] = useState<RotateKind | null>(null)
    const [reveal, setReveal] = useState<{ kind: RotateKind; value: string } | null>(null)

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
            setVerifyResult(await BackendProvider.verifySdkJobServer(firstJobId))
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

                <ProjectSectionsTabs
                    project={project}
                    deploys={deploys}
                    isLoadingDeploys={isLoadingDeploys}
                    secretsExtra={
                        <EnvironmentSection
                            remoteServerUrl={project.remoteServerUrl}
                            hasSigningSecret={project.hasSigningSecret}
                            hasProjectApiKey={project.hasProjectApiKey}
                            onVerifyServer={handleVerifyServer}
                            isVerifyingServer={isVerifying}
                            canVerify={!!firstJobId}
                            onRotate={setPendingRotate}
                        />
                    }
                />
            </PageFrame>

            <SdkJobServerCheckDialog open={!!verifyResult} result={verifyResult} onClose={() => setVerifyResult(null)} />

            <RotateCredentialDialog
                kind={pendingRotate}
                projectId={project.id}
                onClose={() => setPendingRotate(null)}
                onRotated={(kind, value) => {
                    setPendingRotate(null)
                    setReveal({ kind, value })
                }}
            />

            <RevealCredentialDialog reveal={reveal} onClose={() => setReveal(null)} />
        </TooltipProvider>
    )
}

function EnvironmentSection({
    remoteServerUrl,
    hasSigningSecret,
    hasProjectApiKey,
    onVerifyServer,
    isVerifyingServer,
    canVerify,
    onRotate
}: {
    remoteServerUrl: string | null
    hasSigningSecret: boolean
    hasProjectApiKey: boolean
    onVerifyServer: () => void
    isVerifyingServer: boolean
    canVerify: boolean
    onRotate: (kind: RotateKind) => void
}) {
    return (
        <section>
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
                <EnvRow className="flex-1" label="Project API key" rotate={hasProjectApiKey ? () => onRotate("api_key") : undefined}>
                    <ConfigStatus configured={hasProjectApiKey} />
                </EnvRow>
                <EnvRow className="flex-1" label="Signing secret" rotate={hasSigningSecret ? () => onRotate("signing_secret") : undefined}>
                    <ConfigStatus configured={hasSigningSecret} />
                </EnvRow>
            </div>
        </section>
    )
}

function EnvRow({ label, children, className, rotate }: { label: string; children: React.ReactNode; className?: string; rotate?: () => void }) {
    return (
        <div className={cn("px-4 py-3", className)}>
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                <span>{label}</span>
                {rotate && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={rotate}
                                aria-label={`Rotate ${label.toLowerCase()}`}
                                className="text-muted-foreground hover:text-foreground hover:bg-muted/60 -mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors"
                            >
                                <RotateCw className="h-3.5 w-3.5" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>Rotate {label.toLowerCase()}</TooltipContent>
                    </Tooltip>
                )}
            </div>
            <div className="mt-1.5 text-sm">{children}</div>
        </div>
    )
}

function RemoteServerValue({ url }: { url: string | null }) {
    const [copied, setCopied] = useState(false)
    if (!url) return <span className="text-muted-foreground">Not set</span>

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
            <button
                type="button"
                onClick={handleCopy}
                className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                aria-label="Copy server URL"
            >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
        </div>
    )
}

function ConfigStatus({ configured }: { configured: boolean }) {
    return (
        <Badge variant="secondary" className="text-foreground">
            {configured ? <CheckCircle2 className="text-success" /> : <Circle className="text-muted-foreground" />}
            {configured ? "Configured" : "Not set"}
        </Badge>
    )
}

function RotateCredentialDialog({ kind, projectId, onClose, onRotated }: { kind: RotateKind | null; projectId: string; onClose: () => void; onRotated: (kind: RotateKind, value: string) => void }) {
    const [isRotating, setIsRotating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleOpen = (open: boolean) => {
        if (!open && !isRotating) {
            setError(null)
            onClose()
        }
    }

    const handleRotate = async () => {
        if (!kind) return
        setIsRotating(true)
        setError(null)
        try {
            const value = await ROTATE[kind].rotate(projectId)
            onRotated(kind, value)
        } catch {
            setError("Rotation failed. Please try again.")
        } finally {
            setIsRotating(false)
        }
    }

    const config = kind ? ROTATE[kind] : null

    return (
        <Dialog open={!!kind} onOpenChange={handleOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rotate {config?.label}</DialogTitle>
                    <DialogDescription>{config?.confirmDescription}</DialogDescription>
                </DialogHeader>

                <div className="border-warning/30 bg-warning/5 flex items-start gap-3 rounded-lg border p-3">
                    <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1 text-sm">
                        <p className="font-medium">Make sure you can update your server</p>
                        <p className="text-muted-foreground">
                            After rotating, paste the new value into <code className="bg-muted/60 rounded px-1 py-0.5 text-xs">{config?.envVar}</code> on your self-hosted server and restart it.
                        </p>
                    </div>
                </div>

                {error && <p className="text-danger text-xs">{error}</p>}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline" disabled={isRotating}>
                            Cancel
                        </Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={handleRotate} disabled={isRotating}>
                        {isRotating ? "Rotating…" : `Rotate ${config?.label}`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function RevealCredentialDialog({ reveal, onClose }: { reveal: { kind: RotateKind; value: string } | null; onClose: () => void }) {
    const [copied, setCopied] = useState(false)

    const handleOpen = (open: boolean) => {
        if (!open) {
            setCopied(false)
            onClose()
        }
    }

    const handleCopy = async () => {
        if (!reveal) return
        try {
            await navigator.clipboard.writeText(reveal.value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            toast.error("Could not copy")
        }
    }

    const config = reveal ? ROTATE[reveal.kind] : null

    return (
        <Dialog open={!!reveal} onOpenChange={handleOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {config?.icon}
                        Your new {config?.label}
                    </DialogTitle>
                    <DialogDescription>{config?.revealDescription}</DialogDescription>
                </DialogHeader>

                {reveal && (
                    <div className="flex flex-col gap-3">
                        <div className="border-border/60 bg-muted/60 rounded-md border px-3 py-3">
                            <code className="text-foreground block font-mono text-[13px] leading-relaxed break-all select-all">{reveal.value}</code>
                        </div>
                        <Button onClick={handleCopy} variant="outline" className="w-full">
                            {copied ? (
                                <>
                                    <Check className="text-success h-4 w-4" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="h-4 w-4" />
                                    Copy value
                                </>
                            )}
                        </Button>
                    </div>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button>Done</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

type RotateKind = "signing_secret" | "api_key"

type RotateConfig = {
    label: string
    envVar: string
    icon: React.ReactNode
    rotate: (projectId: string) => Promise<string>
    confirmDescription: string
    revealDescription: string
}

const ROTATE: Record<RotateKind, RotateConfig> = {
    signing_secret: {
        label: "signing secret",
        envVar: "TERSE_SIGNING_SECRET",
        icon: <ShieldCheck className="text-primary h-4 w-4" />,
        rotate: async id => (await BackendProvider.rotateProjectSigningSecret(id)).signingSecret,
        confirmDescription:
            "Generates a new signing secret for this project. The current secret stops working immediately, so any trigger from Terse will fail until you update your self-hosted server with the new value.",
        revealDescription: "Copy this secret now. For security, we won't show it again. Update your self-hosted server before triggering any jobs."
    },
    api_key: {
        label: "project API key",
        envVar: "TERSE_PROJECT_KEY",
        icon: <KeyRound className="text-primary h-4 w-4" />,
        rotate: async id => (await BackendProvider.rotateProjectApiKey(id)).projectApiKey,
        confirmDescription:
            "Generates a new project-scoped API key. The current key is revoked immediately, so any callback from your self-hosted server into Terse will be rejected until you update the key on your server.",
        revealDescription: "Copy this key now. For security, we won't show it again. Update your self-hosted server before its next callback into Terse."
    }
}
