import type { ProjectDetailResponse } from "terse-types/types"

import { PageFrame } from "@/components/PageFrame"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useProjectDeploys } from "@/modules/projects/api/useProjectDeploys"

import { DeleteProjectAction, DeploymentsSection, Heading, JobsSection, SecretsSection } from "./ProjectDetailShared"

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

                <SecretsSection projectId={project.id} />

                <DeleteProjectAction project={project} />
            </PageFrame>
        </TooltipProvider>
    )
}
