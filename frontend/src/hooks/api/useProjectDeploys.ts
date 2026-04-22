import useSWR from "swr"
import { projectDeploysKey } from "terse-types/InvalidationKeys"
import type { ProjectDeploysResponse } from "terse-types/types"

import { BackendProvider } from "../../services/backend"

export function useProjectDeploys(projectId: string | null) {
    const key = projectId ? projectDeploysKey(projectId) : null

    const { data, error, isValidating, mutate } = useSWR<ProjectDeploysResponse>(key, projectId ? () => BackendProvider.getProjectDeploys(projectId) : null, {
        keepPreviousData: true,
        revalidateOnFocus: false
    })

    return {
        deploys: data?.deploys,
        isLoading: !!projectId && !data && !error,
        isError: !!error,
        isValidating,
        mutate
    }
}
