import useSWR, { mutate } from "swr"
import { organizationProjectsKey } from "terse-types"
import type { ProjectDetailResponse } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

function projectDetailKey(id: string | null) {
    return id ? ["project", id] : null
}

export function useProject(id: string | null) {
    const { data, error, isValidating, mutate } = useSWR<ProjectDetailResponse>(projectDetailKey(id), id ? () => BackendProvider.getProjectById(id) : null, {
        revalidateOnFocus: false
    })

    return {
        project: data,
        isLoading: !!id && !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}

export function useProjectMutations() {
    const deleteProject = async (id: string) => {
        await BackendProvider.deleteProject(id)
        await mutate(projectDetailKey(id), undefined, { revalidate: false })
        await mutate(key => Array.isArray(key) && key[0] === "agents")
        await mutate(organizationProjectsKey())
    }

    return { deleteProject }
}
