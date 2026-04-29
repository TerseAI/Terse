import { useState } from "react"

import type { ProjectDeploy, ProjectDetailResponse } from "terse-types/types"

import { FileExplorer, FileNode } from "../../components/Code/FileExplorer"
import { TooltipProvider } from "../../components/ui/tooltip"
import { useProjectDeploys } from "../../hooks/api/useProjectDeploys"
import { useProjectSourceFileEditorContent } from "../../hooks/api/useProjectSourceFileEditorContent"
import { useProjectSourceFiles } from "../../hooks/api/useProjectSourceFiles"
import { formatTimestamp } from "../../utility/timeUtils"

import { DeleteProjectAction, DeploymentsSection, Dot, Heading, JobsSection, PageFrame, SectionLabel } from "./ProjectDetailShared"

export default function ProjectDetailManaged({ project }: { project: ProjectDetailResponse }) {
    const { deploys, isLoading: isLoadingDeploys } = useProjectDeploys(project.id)
    const activeDeploy = deploys?.find(d => d.isActive) ?? null
    const latestDeploy = deploys?.[0] ?? null

    return (
        <TooltipProvider delayDuration={200}>
            <PageFrame>
                <Heading project={project} activeDeploy={activeDeploy} latestDeploy={latestDeploy} />

                <JobsSection jobs={project.jobs} />

                <DeploymentsSection projectId={project.id} deploys={deploys} isLoading={isLoadingDeploys} />

                <SourceSection projectId={project.id} activeDeploy={activeDeploy} />

                <DeleteProjectAction project={project} />
            </PageFrame>
        </TooltipProvider>
    )
}

function SourceSection({ projectId, activeDeploy }: { projectId: string; activeDeploy: ProjectDeploy | null }) {
    const { files, isLoading } = useProjectSourceFiles(projectId)
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
    const editor = useProjectSourceFileEditorContent(projectId, selectedFile?.id)

    const hasSource = (files?.length ?? 0) > 0
    const shortDeployId = activeDeploy?.id.slice(-7)

    return (
        <section className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
                <SectionLabel>Source</SectionLabel>
                {activeDeploy ? (
                    <span className="text-muted-foreground flex items-center gap-1.5 text-[11px]">
                        <span>Viewing</span>
                        <code className="text-foreground font-mono tabular-nums">{shortDeployId}</code>
                        <Dot />
                        <span className="tabular-nums">{formatTimestamp(activeDeploy.createdAt)}</span>
                    </span>
                ) : null}
            </div>

            <div className="border-border/60 bg-card relative h-[560px] overflow-hidden rounded-lg border">
                {isLoading ? (
                    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Loading source…</div>
                ) : !hasSource ? (
                    <SourceEmpty hasActiveDeploy={!!activeDeploy} />
                ) : (
                    <FileExplorer
                        files={files as FileNode[]}
                        selectedFile={selectedFile}
                        onSelectFile={setSelectedFile}
                        editorValue={editor.displayContent}
                        editorStatus={editor.status}
                        editorErrorMessage={editor.errorMessage}
                        editorPath={selectedFile?.id ?? null}
                    />
                )}
            </div>
        </section>
    )
}

function SourceEmpty({ hasActiveDeploy }: { hasActiveDeploy: boolean }) {
    return (
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <p className="text-foreground text-sm">{hasActiveDeploy ? "Source archive not available" : "No active deploy"}</p>
            <p className="text-muted-foreground mt-1.5 max-w-sm text-xs">
                {hasActiveDeploy
                    ? "The latest successful deploy is missing its source archive. This can happen after cleanup."
                    : "The source browser shows the code from your latest successful deploy."}
            </p>
        </div>
    )
}
