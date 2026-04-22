import { useParams } from "react-router-dom"

import { useProject } from "../../hooks/api/useProject"

import ProjectDetailManaged from "./ProjectDetailManaged"
import ProjectDetailSelfHosted from "./ProjectDetailSelfHosted"
import { CenteredMessage } from "./ProjectDetailShared"

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>()
    const { project, isLoading, isError } = useProject(id ?? null)

    if (isLoading) {
        return <CenteredMessage text="Loading…" />
    }
    if (isError || !project) {
        return <CenteredMessage text="Project not found" />
    }

    return project.isSelfHosted ? <ProjectDetailSelfHosted project={project} /> : <ProjectDetailManaged project={project} />
}
