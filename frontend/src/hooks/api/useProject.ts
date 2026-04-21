import useSWR from "swr"
import type { ProjectDetailResponse } from "terse-types/types"

import { BackendProvider } from "@/services/backend"

function projectDetailKey(id: string | null) {
    return id ? ["project", id] : null
}

export function useProject(id: string | null) {
    const { data, error, isValidating, mutate } = useSWR<ProjectDetailResponse>(projectDetailKey(id), id ? () => BackendProvider.getProjectById(id) : null)

    return {
        project: data,
        isLoading: !!id && !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}
