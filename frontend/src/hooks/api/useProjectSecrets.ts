import useSWR from "swr"
import { projectSecretsKey } from "terse-types/InvalidationKeys"
import type { ProjectSecretsListResponse } from "terse-types/types"

import { BackendProvider } from "../../services/backend"

export function useProjectSecrets(projectId: string | null) {
    const key = projectId ? projectSecretsKey(projectId) : null

    const { data, error, isValidating, mutate } = useSWR<ProjectSecretsListResponse>(key, projectId ? () => BackendProvider.getProjectSecrets(projectId) : null, {
        keepPreviousData: true,
        revalidateOnFocus: false
    })

    const deleteSecret = async (name: string) => {
        if (!projectId) return
        await BackendProvider.deleteProjectSecret(projectId, name)
        await mutate()
    }

    return {
        secrets: data?.secrets,
        isLoading: !!projectId && !data && !error,
        isError: !!error,
        isValidating,
        deleteSecret,
        mutate
    }
}
