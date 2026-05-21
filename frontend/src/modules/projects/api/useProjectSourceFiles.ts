import useSWR from "swr"
import { projectSourceFilesKey } from "terse-types/InvalidationKeys"
import type { ProjectSourceFilesResponse } from "terse-types/types"

import { BackendProvider } from "@/lib/http"

export function useProjectSourceFiles(projectId: string | null) {
    const key = projectId ? projectSourceFilesKey(projectId) : null

    const { data, error, isValidating, mutate } = useSWR<ProjectSourceFilesResponse>(key, projectId ? () => BackendProvider.getProjectSourceFiles(projectId) : null, {
        keepPreviousData: true,
        revalidateOnFocus: false
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
