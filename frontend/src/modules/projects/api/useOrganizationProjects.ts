import useSWR from "swr"
import { organizationProjectsKey } from "terse-types"
import type { ProjectsListResponse } from "terse-types/types"

import { BackendProvider } from "@/lib/http"

export function useOrganizationProjects() {
    const { data, error, isValidating, mutate } = useSWR<ProjectsListResponse>(organizationProjectsKey(), () => BackendProvider.listProjects(), {
        revalidateOnFocus: false
    })

    return {
        projects: data?.projects ?? [],
        isLoading: !data && !error,
        isError: error,
        isValidating,
        mutate
    }
}
