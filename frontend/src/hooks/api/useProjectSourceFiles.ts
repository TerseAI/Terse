import useSWR from "swr"
import type { ProjectSourceFilesResponse } from "terse-types/types"
import { projectSourceFilesKey } from "terse-types/InvalidationKeys"

import { BackendProvider } from "../../services/backend"

export function useProjectSourceFiles(projectId: string | null) {
    const key = projectId ? projectSourceFilesKey(projectId) : null

    const { data, error, isValidating, mutate } = useSWR<ProjectSourceFilesResponse>(key, projectId ? () => BackendProvider.getProjectSourceFiles(projectId) : null, {
        keepPreviousData: true
    })

    return {
        files: data?.files,
        deployId: data?.deployId ?? null,
        deployedAt: data?.deployedAt ?? null,
        isLoading: !!projectId && !data && !error,
        isError: !!error,
        isValidating,
        mutate
    }
}
