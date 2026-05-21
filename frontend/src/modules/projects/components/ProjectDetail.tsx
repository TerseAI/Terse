import { useParams } from "react-router-dom"

import { useProject } from "@/modules/projects/api/useProject"

import ProjectDetailManaged from "./ProjectDetailManaged"
import ProjectDetailSelfHosted from "./ProjectDetailSelfHosted"
import { CenteredMessage } from "./ProjectDetailShared"

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>()

    if (!id) {
        return <CenteredMessage text="Invalid project ID" />
    }

    const { project, isLoading, isError } = useProject(id)

    if (isLoading) {
        return <CenteredMessage text="Loading…" />
    }
    if (isError || !project || !id) {
        return <CenteredMessage text="Project not found" />
    }

    return project.isSelfHosted ? <ProjectDetailSelfHosted project={project} /> : <ProjectDetailManaged project={project} />
}
